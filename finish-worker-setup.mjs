import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const url = 'https://gbfh-meal-scheduler.2023110553.workers.dev'
const meal = process.argv[2] ?? 'breakfast'
if (!['breakfast', 'lunch', 'dinner'].includes(meal)) throw Error('Use breakfast, lunch or dinner.')
const wrangler = fileURLToPath(new URL('./node_modules/wrangler/bin/wrangler.js', import.meta.url))
if (!existsSync(wrangler)) throw Error('Run npm.cmd install first.')
const token = randomBytes(32).toString('hex')
const result = spawnSync(process.execPath, [wrangler, 'secret', 'put', 'ADMIN_TOKEN'], {
  cwd: fileURLToPath(new URL('.', import.meta.url)),
  input: token + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
})
// Do not print subprocess output because it handles a secret.
if (result.error || result.status !== 0) throw Error('ADMIN_TOKEN registration failed. Check Cloudflare login and Free plan configuration.')
console.log('ADMIN_TOKEN registered securely. The value is not displayed or saved locally.')
async function call(dryRun) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ meal, dryRun }), signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw Error(`Worker returned HTTP ${response.status}. Check wrangler tail. Cron remains disabled.`)
  return response.json()
}
const preview = await call(true)
if (preview.status !== 'preview') throw Error('Unexpected dry-run response.')
console.log('DRY_RUN', preview.title, preview.message)
const sent = await call(false)
if (sent.status === 'duplicate') {
  console.log('ALREADY_RECORDED', sent.record?.status)
  console.log('No additional push sent. Check the existing notification or choose another meal.')
  process.exit(0)
}
if (sent.status !== 'accepted') throw Error('ntfy acceptance was not confirmed.')
console.log('NTFY_ACCEPTED', sent.date, sent.meal)
const duplicate = await call(false)
if (duplicate.status !== 'duplicate') throw Error('Duplicate protection check failed.')
console.log('DUPLICATE_BLOCKED')
console.log('Check the phone for the menu notification and report receipt. Cron has not been enabled.')
