import { describe, expect, it } from 'vitest'
import { arrowLine, squareCenter } from './arrows'
import { highlightStyles } from './highlights'

describe('board arrows', () => {
  it('puts d1 on the bottom rank for white', () => {
    expect(squareCenter('d1', 'white')).toEqual({ x: 3.5, y: 7.5 })
    expect(squareCenter('d1', 'black').y).toBeLessThan(1)
  })

  it('shortens the arrow before the target centre', () => {
    const line = arrowLine('e2', 'e4', 'white')
    expect(line.x).toBeCloseTo(4.5)
    expect(line.y).toBeGreaterThan(line.y2)
    expect(line.y2).toBeGreaterThan(squareCenter('e4', 'white').y)
  })
})

describe('square highlights', () => {
  it('leaves the starting position unmarked', () => {
    expect(highlightStyles({ lastFrom: null, lastTo: null, selected: null, checkSquare: null, targets: [] })).toEqual({})
  })

  it('uses a small dot on an empty square and a thin ring on a capture', () => {
    const styles = highlightStyles({
      lastFrom: null,
      lastTo: null,
      selected: null,
      checkSquare: null,
      targets: [
        { to: 'e4', captured: false },
        { to: 'd5', captured: true },
      ],
    })
    expect(String(styles.e4?.backgroundImage)).toContain('12.5%')
    expect(String(styles.e4?.backgroundImage)).not.toContain('#111827')
    expect(String(styles.d5?.backgroundImage)).toContain('transparent 76%')
    expect(String(styles.d5?.backgroundImage)).not.toContain('#111827')
  })

  it('marks only the squares of the last move', () => {
    const styles = highlightStyles({ lastFrom: 'e2', lastTo: 'e4', selected: null, checkSquare: null, targets: [] })
    expect(Object.keys(styles).sort()).toEqual(['e2', 'e4'])
    expect(styles.d1).toBeUndefined()
  })
})
