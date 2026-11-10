import { describe, expect, it } from 'vitest'
import { eloLine, radarPoints } from './charts'

describe('dashboard charts', () => {
  it('draws one point per subscore and keeps the line inside the box', () => {
    const radar = radarPoints([0, 100, 50], 80, 80, 60).split(' ')
    expect(radar).toHaveLength(3)
    expect(radar[0]).toBe('80.0,80.0')
    const [x, y] = (radar[1] ?? '0,0').split(',').map(Number)
    expect(Math.hypot((x ?? 0) - 80, (y ?? 0) - 80)).toBeCloseTo(60, 0)
    const line = eloLine([1400, 1500, 1450], 200, 80)
    for (const pair of line.split(' ')) {
      const [x, y] = pair.split(',').map(Number)
      expect(x).toBeGreaterThanOrEqual(12)
      expect(x).toBeLessThanOrEqual(188)
      expect(y).toBeGreaterThanOrEqual(12)
      expect(y).toBeLessThanOrEqual(68)
    }
  })
})
