export const hours = { breakfast: 7, lunch: 11, dinner: 17 }
export const labels = { breakfast: '아침', lunch: '점심', dinner: '저녁' }
export function kstDate(time) { return new Date(time + 9 * 3600000).toISOString().slice(0, 10) }
export function plan(meal, scheduled, now, manual = false) {
  if (!Object.hasOwn(hours, meal)) throw Error('Invalid meal')
  const date = kstDate(scheduled)
  const target = Date.parse(`${date}T${String(hours[meal]).padStart(2, '0')}:00:00+09:00`)
  if (!manual && (scheduled < target || scheduled > target + 15 * 60000 || now < target || now > target + 15 * 60000)) {
    return { status: 'late', date, meal }
  }
  return { status: 'ready', date, meal, key: `${date}/${meal}` }
}
export function notification(data, date, meal) {
  if (!data || Array.isArray(data) || typeof data !== 'object') throw Error('Invalid meal JSON')
  const lines = data[date]?.[meal]
  if (!Array.isArray(lines) || lines.some(x => typeof x !== 'string')) return null
  const menu = lines.map(x => x.trim()).filter(x => x && !/^\([^)]*[:：][^)]*\)$/.test(x))
  if (!menu.length || menu.every(x => /^(미등록|등록예정|휴무|운영없음|[-–—\s]+)$/.test(x))) return null
  return { title: `${date} ${labels[meal]} 식단`, message: menu.join(' · ') }
}
