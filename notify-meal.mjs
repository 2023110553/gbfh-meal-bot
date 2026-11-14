import { readFile } from 'node:fs/promises'

const labels = { breakfast: '아침', lunch: '점심', dinner: '저녁' }
const meal = process.env.MEAL
if (!Object.hasOwn(labels, meal)) throw new Error('Select breakfast, lunch or dinner.')

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts()
const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
const date = [dateParts.year, dateParts.month, dateParts.day].join('-')
const data = JSON.parse(await readFile(new URL('./meals.json', import.meta.url), 'utf8'))
const menu = Array.isArray(data[date]?.[meal])
  ? data[date][meal].filter(line => typeof line === 'string' && line.trim() && !/^\s*\([^)]*:[^)]*\)\s*$/.test(line))
  : []

if (menu.length === 0) {
  console.log(`No menu for ${date} (${meal}).`)
} else {
  const notification = {
    topic: process.env.NTFY_TOPIC,
    title: `${date} ${labels[meal]} 식단`,
    message: menu.join(' · '),
  }
  if (process.argv.includes('--preview')) {
    console.log(notification.title, notification.message)
  } else {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(notification.topic ?? '')) {
      throw new Error('Set NTFY_TOPIC to a random topic of 16–64 characters.')
    }
    const response = await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`ntfy returned HTTP ${response.status}.`)
    console.log(`ntfy accepted ${date} (${meal}).`)
  }
}
