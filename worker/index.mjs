import { DurableObject } from 'cloudflare:workers'
import { plan, notification, scheduledMeal } from '../meal-core.mjs'

export class Sender extends DurableObject {
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const { meal, scheduled, manual, dryRun } = await request.json()
      const item = plan(meal, scheduled, Date.now(), manual)
      if (item.status !== 'ready') return Response.json(item)
      const previous = await this.ctx.storage.get(item.key)
      if (previous && !dryRun) return Response.json({ status: 'duplicate', record: previous })
      const response = await fetch(this.env.MEALS_URL, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw Error(`GitHub HTTP ${response.status}`)
      const data = await response.json()
      const message = notification(data, item.date, meal)
      if (!message) {
        console.error(JSON.stringify({ status: 'missing-menu', date: item.date, meal, latest: Object.keys(data).sort().at(-1) }))
        return Response.json({ status: 'missing-menu' }, { status: 409 })
      }
      if (dryRun) return Response.json({ status: 'preview', ...message })
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(this.env.NTFY_TOPIC ?? '')) throw Error('Missing NTFY_TOPIC')
      // Persist before delivery. Ambiguous network failures stay blocked to avoid duplicate pushes.
      await this.ctx.storage.put(item.key, { status: 'attempting', at: new Date().toISOString() })
      try {
        const sent = await fetch('https://ntfy.sh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: this.env.NTFY_TOPIC, ...message }),
          signal: AbortSignal.timeout(10000),
        })
        if (!sent.ok) throw Error(`ntfy HTTP ${sent.status}`)
        await this.ctx.storage.put(item.key, { status: 'accepted', at: new Date().toISOString() })
      } catch (error) {
        await this.ctx.storage.put(item.key, { status: 'uncertain', at: new Date().toISOString(), error: error.message })
        throw error
      }
      return Response.json({ status: 'accepted', date: item.date, meal })
    })
  }
}
export default {
  async scheduled(event, env) {
    const meal = scheduledMeal(event.scheduledTime)
    if (!meal) { console.log('Skipped non-matching meal time'); return }
    const response = await invoke(env, { meal, scheduled: event.scheduledTime })
    console.log(await response.text())
    if (!response.ok) throw Error('Scheduled delivery failed')
  },
  async fetch(request, env) {
    if (!env.ADMIN_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (request.method !== 'POST') return new Response('POST required', { status: 405 })
    const body = await request.json()
    return invoke(env, { meal: body.meal, scheduled: Date.now(), manual: true, dryRun: body.dryRun !== false })
  },
}
function invoke(env, body) {
  const stub = env.SENDER.get(env.SENDER.idFromName('meal-sender'))
  return stub.fetch('https://sender.internal', { method: 'POST', body: JSON.stringify(body) })
}
