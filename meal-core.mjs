import holidays from './holidays.json' with { type: 'json' }
export const labels = { breakfast: '아침', lunch: '점심', dinner: '저녁' }
export function kstDate(time) { return new Date(time + 9 * 3600000).toISOString().slice(0, 10) }
export function mealTime(date, meal) {
  if (!Object.hasOwn(labels, meal)) throw Error('Invalid meal')
  const year = date.slice(0, 4)
  if (!Object.hasOwn(holidays.years, year)) throw Error(`Holiday calendar missing for ${year}`)
  const day = new Date(`${date}T12:00:00+09:00`).getUTCDay()
  const rest = day === 0 || day === 6 || holidays.years[year].includes(date)
  const month = Number(date.slice(5, 7))
  if (meal === 'breakfast') return rest || month <= 2 || month === 12 ? '06:00' : '05:30'
  if (meal === 'lunch') return rest ? '11:00' : '10:30'
  return '17:00'
}
export function scheduledMeal(time) {
  const date = kstDate(time)
  const clock = new Date(time + 9 * 3600000).toISOString().slice(11, 16)
  return Object.keys(labels).find(meal => mealTime(date, meal) === clock)
}
export function plan(meal, scheduled, now, manual = false) {
  if (!Object.hasOwn(labels, meal)) throw Error('Invalid meal')
  const date = kstDate(scheduled)
  if (manual) return { status: 'ready', date, meal, key: `${date}/${meal}` }
  const target = Date.parse(`${date}T${mealTime(date, meal)}:00+09:00`)
  // Cron timestamps may include seconds. Match the scheduled minute, while
  // measuring the 15-minute deadline from the configured meal time.
  const scheduledMinute = Math.floor(scheduled / 60000) * 60000
  if (scheduledMinute !== target || now < target || now - target >= 15 * 60000) return { status: 'late', date, meal }
  return { status: 'ready', date, meal, key: `${date}/${meal}` }
}
export function notification(data, date, meal) {
  if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('Invalid meal JSON')
  const lines = data[date]?.[meal]
  if (!Array.isArray(lines) || lines.some(x => typeof x !== 'string')) return null
  const menu = lines.map(x => x.trim()).filter(x => x && !/^\([^)]*[:：][^)]*\)$/.test(x))
  if (!menu.length || menu.every(x => /^(미등록|등록예정|휴무|운영없음|[-–—\s]+)$/.test(x))) return null
  return { title: `${date} ${labels[meal]} 식단`, message: menu.join(' · '), priority: 4 }
}
