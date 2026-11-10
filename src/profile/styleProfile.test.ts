import { Chess, type Square } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { styleProfile, type StyleGame } from './styleProfile'

function game(uci: string[], updatedAt: number): StyleGame {
  const chess = new Chess()
  const moves: StyleGame['moves'] = []
  uci.forEach((token, index) => {
    const fenBefore = chess.fen()
    const from = token.slice(0, 2) as Square
    const to = token.slice(2, 4) as Square
    chess.move({ from, to })
    moves.push({ fenBefore, uci: token, byUser: index % 2 === 0 })
  })
  return { updatedAt, moves }
}

const line = ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f1c4', 'f8c5', 'e1g1', 'e8g8', 'd2d3', 'd7d6', 'b1c3', 'c8e6', 'd1e2', 'd8e7']

describe('style profile', () => {
  it('hides a metric until there are enough moves and then reports the real share', () => {
    const few = styleProfile([game(line.slice(0, 4), 1_000)], 1_000)
    expect(few.metrics.find((metric) => metric.id === 'develop')?.value).toBeNull()
    expect(few.metrics.find((metric) => metric.id === 'castle')?.value).toBeNull()

    const profile = styleProfile(Array.from({ length: 3 }, () => game(line, 1_000)), 1_000)
    const develop = profile.metrics.find((metric) => metric.id === 'develop')
    expect(develop?.samples).toBe(21)
    expect(develop?.value).toBe(43)
  })

  it('gives a newer game more weight than the same game from two months ago', () => {
    const now = 10_000_000_000
    const month = 30 * 86_400_000
    const recent = styleProfile([game(line, now)], now)
    const old = styleProfile([game(line, now - 2 * month)], now)
    expect(recent.weight).toBeGreaterThan(old.weight)
  })
})
