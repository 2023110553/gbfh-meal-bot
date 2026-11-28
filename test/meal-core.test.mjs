import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plan, notification, mealTime, scheduledMeal } from '../meal-core.mjs'
const cases = [
  ['2026-11-27', '05:30', '10:30'],
  ['2026-12-01', '06:00', '10:30'],
  ['2026-11-28', '06:00', '11:00'],
  ['2026-11-29', '06:00', '11:00'],
  ['2026-03-02', '06:00', '11:00'],
  ['2026-02-17', '06:00', '11:00'],
  ['2026-09-25', '06:00', '11:00'],
  ['2026-05-25', '06:00', '11:00'],
  ['2026-06-03', '06:00', '11:00'],
  ['2027-03-02', '05:30', '10:30'],
]
for (const [date, breakfast, lunch] of cases) {
  test(`KST meal times ${date}`, () => {
    for (const [meal, clock] of Object.entries({ breakfast, lunch, dinner: '17:00' })) {
      assert.equal(mealTime(date, meal), clock)
      const time = Date.parse(`${date}T${clock}:00+09:00`)
      assert.equal(scheduledMeal(time), meal)
      assert.equal(plan(meal, time, time).status, 'ready')
      assert.equal(plan(meal, time, time + 899999).status, 'ready')
      assert.equal(plan(meal, time, time + 900000).status, 'late')
      assert.equal(plan(meal, time, time + 86400000).status, 'late')
    }
  })
}
test('UTC previous day, wrong candidate and unknown calendar', () => {
  const time = Date.parse('2026-11-26T20:30:00Z')
  assert.equal(plan('breakfast', time, time).date, '2026-11-27')
  assert.equal(scheduledMeal(Date.parse('2026-11-27T21:00:00Z')), 'breakfast')
  assert.equal(scheduledMeal(Date.parse('2026-11-26T21:00:00Z')), undefined)
  assert.throws(() => mealTime('2031-01-01', 'lunch'), /missing/)
})
test('missing menu and origin removal', () => {
  assert.equal(notification({}, '2026-11-27', 'dinner'), null)
  const result = notification({'2026-11-27': {dinner: ['밥', '(돈육:국내산)']}}, '2026-11-27', 'dinner')
  assert.equal(result.message, '밥')
  assert.equal(result.priority, 4)
})

test('production scheduled timestamps include seconds', () => {
  const events = [
    ['breakfast', 1795813202000, '2026-11-28T06:00:03.096+09:00'],
    ['lunch', 1795831250000, '2026-11-28T11:00:51.399+09:00'],
    ['dinner', 1795766450000, '2026-11-27T17:00:51.565+09:00'],
  ]
  for (const [meal, scheduled, actual] of events) {
    const now = Date.parse(actual)
    assert.equal(scheduledMeal(scheduled), meal)
    assert.equal(plan(meal, scheduled, now).status, 'ready')
    const target = Math.floor(scheduled / 60000) * 60000
    assert.equal(plan(meal, scheduled, target + 899999).status, 'ready')
    assert.equal(plan(meal, scheduled, target + 900000).status, 'late')
    assert.equal(plan(meal, scheduled, target - 1).status, 'late')
    assert.equal(plan(meal, scheduled, target + 86400000).status, 'late')
  }
})
test('wrong minute and weekend candidate remain blocked', () => {
  const target = Date.parse('2026-11-28T11:00:00+09:00')
  for (const offset of [-1, 60000, 14 * 60000]) {
    assert.equal(plan('lunch', target + offset, target + 14 * 60000).status, 'late')
  }
  const weekdaySlot = Date.parse('2026-11-28T10:30:40+09:00')
  assert.equal(scheduledMeal(weekdaySlot), undefined)
  assert.equal(plan('lunch', weekdaySlot, weekdaySlot).status, 'late')
})
