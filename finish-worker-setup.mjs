import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const url = 'https://gbfh-meal-scheduler.2023110553.workers.dev'
const initialize = process.argv.includes('--init')
const dryRun = process.argv.includes('--dry-run')
const meal = process.argv.slice(2).find(x => !x.startsWith('--')) ?? 'breakfast'
if (!['breakfast', 'lunch', 'dinner'].includes(meal)) throw Error('Use breakfast, lunch or dinner.')
if (process.platform !== 'win32') throw Error('Run this helper on Windows. It uses Windows DPAPI for the local credential.')
const dir = join(process.env.LOCALAPPDATA || homedir(), 'GBFH')
const credential = join(dir, 'worker-admin.dpapi')
const powershell = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
function protect(value, decrypt = false) {
  const script = decrypt
    ? '$s = [Console]::In.ReadToEnd().Trim() | ConvertTo-SecureString; $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }'
    : '$s = ConvertTo-SecureString -String ([Console]::In.ReadToEnd().Trim()) -AsPlainText -Force; [Console]::Write(($s | ConvertFrom-SecureString))'
  const result = spawnSync(powershell, ['-NoProfile', '-Command', script], { input: value, encoding: 'utf8', windowsHide: true })
  if (result.error || result.status !== 0) throw Error('Windows credential protection failed.')
  return result.stdout.trim()
}
let token
if (existsSync(credential)) {
  token = protect(readFileSync(credential, 'utf8'), true)
} else {
  if (!initialize) throw Error('First run: node finish-worker-setup.mjs --init --dry-run breakfast')
  token = randomBytes(32).toString('hex')
  mkdirSync(dir, { recursive: true })
  // Persist encrypted first so interrupted initialization can reuse the same value.
  writeFileSync(credential, protect(token), { mode: 0o600 })
}
if (initialize) {
  const wrangler = fileURLToPath(new URL('./node_modules/wrangler/bin/wrangler.js', import.meta.url))
  if (!existsSync(wrangler)) throw Error('Run npm.cmd install first.')
  const result = spawnSync(process.execPath, [wrangler, 'secret', 'put', 'ADMIN_TOKEN'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)), input: token + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  })
  if (result.error || result.status !== 0) throw Error('ADMIN_TOKEN registration failed. Retry --init to reuse the same token.')
  console.log('ADMIN_TOKEN registered; encrypted local credential ready.')
}
async function call(preview) {
  for (let attempt = 0; attempt < (preview ? 6 : 1); attempt++) {
    const response = await fetch(url, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal, dryRun: preview }), signal: AbortSignal.timeout(30000),
    })
    if (response.status === 401 && preview && attempt < 5) { await new Promise(resolve => setTimeout(resolve, 2000)); continue }
    if (!response.ok) throw Error(`Worker HTTP ${response.status}. For 401, use --init to re-register the saved token. No token was printed.`)
    return response.json()
  }
}
const preview = await call(true)
if (preview.status !== 'preview') throw Error('Unexpected preview response.')
console.log('DRY_RUN', preview.title, preview.message)
if (!dryRun) {
  const sent = await call(false)
  if (sent.status === 'duplicate') console.log('DUPLICATE_BLOCKED', sent.record?.status)
  else {
    if (sent.status !== 'accepted') throw Error('ntfy acceptance not confirmed.')
    console.log('NTFY_ACCEPTED', sent.date, sent.meal)
    if ((await call(false)).status !== 'duplicate') throw Error('Duplicate check failed.')
    console.log('DUPLICATE_BLOCKED')
  }
}
