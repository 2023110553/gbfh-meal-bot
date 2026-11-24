import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plan, notification } from '../meal-core.mjs'
for (const [meal, hour] of Object.entries({breakfast: '07', lunch: '11', dinner: '17'})) {
  test(meal, () => {
    const time = Date.parse(`2026-11-15T${hour}:00:00+09:00`)
    assert.equal(plan(meal, time, time).status, 'ready')
    assert.equal(plan(meal, time, Date.parse('2026-11-16T00:06:00+09:00')).status, 'late')
  })
}
test('missing and origin lines', () => {
  assert.equal(notification({}, '2026-11-15', 'dinner'), null)
  assert.equal(notification({'2026-11-15':{dinner:['밥','(돈육:국내산)']}}, '2026-11-15','dinner').message,'밥')
})
