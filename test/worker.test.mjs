import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as core from '../meal-core.mjs'

test('durable ledger, dry run, missing data, network and uncertain delivery', async () => {
  const source = (await readFile(new URL('../worker/index.mjs', import.meta.url), 'utf8'))
    .replace("import { DurableObject } from 'cloudflare:workers'", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env } }')
    .replace("import { plan, notification, scheduledMeal } from '../meal-core.mjs'", 'const { plan, notification, scheduledMeal } = globalThis.__mealCore')
  globalThis.__mealCore = core
  const { Sender } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
  const records = new Map()
  const ctx = {
    blockConcurrencyWhile: fn => fn(),
    storage: { get: async k => records.get(k), put: async (k,v) => { if (mode === 'storage-error') throw Error('Simulated storage failure'); records.set(k,v) } },
  }
  const sender = new Sender(ctx, { MEALS_URL: 'https://example.org/meals.json', NTFY_TOPIC: 'test-topic-123456789' })
  const date = core.kstDate(Date.now())
  let menu = { [date]: { dinner: ['밥','(돈육:국내산)'] } }
  let delivered = 0
  let mode = 'ok'
  const original = globalThis.fetch
  globalThis.fetch = async url => {
    if (url !== 'https://ntfy.sh') {
      if (mode === 'github-error') return new Response('', {status:503})
      return Response.json(menu)
    }
    delivered++
    if (mode === 'timeout') throw Error('timeout')
    if (mode === 'ntfy-error') return new Response('',{status:429})
    return Response.json({id:'example'})
  }
  const run = dryRun => sender.fetch(new Request('https://test', {
    method:'POST',body:JSON.stringify({meal:'dinner',scheduled:Date.now(),manual:true,dryRun}),
  }))
  try {
    assert.equal((await (await run(true)).json()).status,'preview')
    assert.equal(delivered,0)
    assert.equal((await (await run(false)).json()).status,'accepted')
    assert.equal((await (await run(false)).json()).status,'duplicate')
    assert.equal(delivered,1)
    records.clear(); menu={}
    assert.equal((await run(false)).status,409)
    assert.equal(delivered,1)
    mode='github-error'
    const githubError = await run(false)
    assert.equal(githubError.status, 502)
    assert.equal((await githubError.json()).stage, 'github-fetch')
    assert.equal(records.size,0)
    menu={ [date]: { dinner:['밥'] } }; mode='ntfy-error'
    const ntfyError = await run(false)
    assert.equal(ntfyError.status, 502)
    const detail = await ntfyError.json()
    assert.equal(detail.stage, 'ntfy-http')
    assert.equal(detail.upstreamStatus, 429)
    assert.equal([...records.values()][0].status,'rejected')
    records.clear(); mode='timeout'
    assert.equal((await run(false)).status, 502)
    assert.equal([...records.values()][0].status, 'uncertain')
    assert.equal((await (await run(false)).json()).status,'duplicate')
    const snapshot = JSON.stringify([...records])
    const inspection = await sender.fetch(new Request('https://test', {
      method:'POST', body:JSON.stringify({meal:'dinner', scheduled:Date.now(), manual:true, inspect:true}),
    }))
    assert.equal((await inspection.json()).record.status, 'uncertain')
    assert.equal(JSON.stringify([...records]), snapshot)
    records.clear(); mode='storage-error'
    const before = delivered
    const storageError = await run(false)
    assert.equal(storageError.status, 500)
    assert.equal((await storageError.json()).stage, 'storage-attempt')
    assert.equal(delivered, before)
  } finally { globalThis.fetch=original; delete globalThis.__mealCore }
})
