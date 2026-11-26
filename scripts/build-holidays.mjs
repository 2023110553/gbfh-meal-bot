import Holidays from 'date-holidays'
import { writeFile } from 'node:fs/promises'
const hd = new Holidays('KR')
const years = {}
for (let year = 2026; year <= 2030; year++) {
  const dates = []
  for (const holiday of hd.getHolidays(year).filter(x => x.type === 'public')) {
    const first = Date.parse(holiday.date.slice(0, 10) + 'T00:00:00Z')
    const count = Math.max(1, Math.round((holiday.end - holiday.start) / 86400000))
    for (let offset = 0; offset < count; offset++) dates.push(new Date(first + offset * 86400000).toISOString().slice(0, 10))
  }
  years[year] = [...new Set(dates)].sort()
}
years['2026'] = [...new Set([...years['2026'], '2026-06-03'])].sort()
await writeFile(new URL('../holidays.json', import.meta.url), JSON.stringify({ source: 'date-holidays KR public rules; 2026 local election override', years }, null, 2) + '\n')
