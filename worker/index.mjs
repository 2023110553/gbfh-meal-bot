import { DurableObject } from 'cloudflare:workers'
import { plan, notification, scheduledMeal } from '../meal-core.mjs'

function safeError(error, env) {
  let message = String(error?.message ?? 'Unknown failure')
  for (const secret of [env.NTFY_TOPIC, env.ADMIN_TOKEN]) {
    if (secret) message = message.split(secret).join('[redacted]')
  }
  return message.slice(0, 500)
}
function failure(error, env, stage, traceId, status = 500, httpStatus, details = {}) {
  const result = { status: 'error', stage, traceId, message: safeError(error, env), ...details }
  if (httpStatus) result.upstreamStatus = httpStatus
  console.error(JSON.stringify(result))
  return Response.json(result, { status })
}

export class Sender extends DurableObject {
  async fetch(request) {
      const traceId = crypto.randomUUID()
      let stage = 'request'
      try {
        const { meal, scheduled, manual, dryRun, inspect, probe, retryRejected } = await request.json()
        const item = plan(meal, scheduled, Date.now(), manual)
        if (item.status !== 'ready') return Response.json(item)
        if (probe) item.key = 'probe/' + item.key
        stage = 'storage-read'
        const previous = await this.ctx.storage.get(item.key)
        if (inspect) {
          return Response.json({ status: 'record', date: item.date, meal, record: previous ? {
            status: previous.status, at: previous.at, upstreamStatus: previous.upstreamStatus,
            stage: previous.stage, traceId: previous.traceId, retryAt: previous.retryAt, rateLimit: previous.rateLimit, ntfyCode: previous.ntfyCode, attempts: previous.attempts,
            error: previous.error ? safeError(new Error(previous.error), this.env) : undefined,
          } : null })
        }
        const canRetry = record => manual && probe && retryRejected && record?.status === 'rejected' && record.upstreamStatus === 429 && Date.now() >= (record.retryAt ?? Date.parse(record.at) + 300000) && (record.attempts ?? 1) < 3
        if (previous && !dryRun && !canRetry(previous)) return Response.json({ status: 'duplicate', record: {
          status: previous.status, at: previous.at, upstreamStatus: previous.upstreamStatus,
          stage: previous.stage, traceId: previous.traceId, retryAt: previous.retryAt, rateLimit: previous.rateLimit, ntfyCode: previous.ntfyCode, attempts: previous.attempts,
        } })
        stage = 'github-fetch'
        const response = await fetch(this.env.MEALS_URL, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        if (!response.ok) return failure(new Error('GitHub request rejected'), this.env, stage, traceId, 502, response.status)
        stage = 'github-json'
        const data = await response.json()
        const message = notification(data, item.date, meal)
        if (!message) {
          console.error(JSON.stringify({ status: 'missing-menu', date: item.date, meal, latest: Object.keys(data).sort().at(-1), traceId }))
          return Response.json({ status: 'missing-menu', traceId }, { status: 409 })
        }
        if (dryRun) return Response.json({ status: 'preview', ...message })
        if (!manual && plan(meal, scheduled, Date.now()).status !== 'ready') return Response.json({ status: 'late', date: item.date, meal })
        stage = 'ntfy-config'
        if (!/^[A-Za-z0-9_-]{16,64}$/.test(this.env.NTFY_TOPIC ?? '')) throw Error('NTFY_TOPIC missing or invalid; verify the existing topic Secret')
        stage = 'storage-attempt'
        const reserved = await this.ctx.storage.transaction(async transaction => {
          const current = await transaction.get(item.key)
          if (current && !canRetry(current)) return current
          await transaction.put(item.key, { status: 'attempting', at: new Date().toISOString(), traceId, attempts: (current ? (current.attempts ?? 1) : 0) + 1, previous: current ?? null })
          return null
        })
        if (reserved) return Response.json({ status: 'duplicate', record: { status: reserved.status, at: reserved.at } })
        stage = 'ntfy-fetch'
        let sent
        try {
          sent = await fetch('https://ntfy.sh', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: this.env.NTFY_TOPIC, ...message }),
            signal: AbortSignal.timeout(10000),
          })
        } catch (error) {
          stage = 'storage-uncertain'
          await this.ctx.storage.put(item.key, { ...(await this.ctx.storage.get(item.key)), status: 'uncertain', at: new Date().toISOString(), stage: 'ntfy-fetch', error: safeError(error, this.env), traceId })
          return failure(error, this.env, 'ntfy-fetch', traceId, 502)
        }
        if (!sent.ok) {
          stage = 'storage-rejected'
          const errorBody = await sent.json().catch(() => ({}))
          const retryHeader = sent.headers.get('Retry-After')
          const delay = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) * 1000 : 300000
          const retryAt = retryHeader && !/^\d+$/.test(retryHeader) && Number.isFinite(Date.parse(retryHeader)) ? Date.parse(retryHeader) : Date.now() + delay
          const details = {
            ntfyCode: Number.isFinite(errorBody.code) ? errorBody.code : undefined,
            retryAt, rateLimit: sent.headers.get('RateLimit') ?? undefined,
          }
          const attempt = await this.ctx.storage.get(item.key)
          await this.ctx.storage.put(item.key, { ...attempt, status: 'rejected', at: new Date().toISOString(), stage: 'ntfy-http', upstreamStatus: sent.status, traceId, ...details })
          return failure(new Error('ntfy request rejected'), this.env, 'ntfy-http', traceId, 502, sent.status, details)
        }
        stage = 'storage-accepted'
        await this.ctx.storage.put(item.key, { ...(await this.ctx.storage.get(item.key)), status: 'accepted', at: new Date().toISOString(), traceId })
        console.log(JSON.stringify({ status: 'accepted', date: item.date, meal, traceId }))
        return Response.json({ status: 'accepted', date: item.date, meal, traceId })
      } catch (error) {
        return failure(error, this.env, stage, traceId)
      }
  }
}
export default {
  async scheduled(event, env) {
    const meal = scheduledMeal(event.scheduledTime)
    if (!meal) { console.log('Skipped non-matching meal time'); return }
    const response = await invoke(env, { meal, scheduled: event.scheduledTime })
    console.log(await response.text())
    if (!response.ok) throw Error('Scheduled delivery failed; inspect the preceding stage and traceId')
  },
  async fetch(request, env) {
    if (!env.ADMIN_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (request.method !== 'POST') return new Response('POST required', { status: 405 })
    let body
    try { body = await request.json() } catch { return Response.json({ status: 'invalid-json' }, { status: 400 }) }
    if (!['breakfast', 'lunch', 'dinner'].includes(body.meal)) return Response.json({ status: 'invalid-meal' }, { status: 400 })
    return invoke(env, { meal: body.meal, scheduled: Date.now(), manual: true, dryRun: body.dryRun !== false, inspect: body.inspect === true, probe: body.probe === true, retryRejected: body.retryRejected === true })
  },
}
async function invoke(env, body) {
  try {
    const stub = env.SENDER.get(env.SENDER.idFromName('meal-sender'))
    return await stub.fetch('https://sender.internal', { method: 'POST', body: JSON.stringify(body) })
  } catch (error) {
    return failure(error, env, 'durable-object-rpc', crypto.randomUUID())
  }
}
