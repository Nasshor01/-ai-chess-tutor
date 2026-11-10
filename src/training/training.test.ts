import { describe, expect, it } from 'vitest'
import { cardsFromMoves, dueCards, mergeCards, type SourceMove } from './items'
import { reviewSm2 } from './sm2'
import { foldRollups, trendLines, type Rollup } from './trend'

const NOW = Date.parse('2026-06-01T00:00:00Z')
const DAY = 86_400_000

function mistake(ply: number, theme: string, best = 'e2e4'): SourceMove {
  return {
    gameId: 'g',
    ply,
    fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    uci: 'd2d4',
    san: 'd4',
    byUser: true,
    category: `blunder|${theme}`,
    bestUci: best,
  }
}

describe('training cards', () => {
  it('builds cards only from a repeated mistake in the player’s own games', () => {
    const cards = cardsFromMoves(
      [mistake(0, 'vidlička'), mistake(4, 'vidlička'), mistake(8, 'visí'), { ...mistake(2, 'vidlička'), byUser: false }],
      NOW,
    )
    expect(cards).toHaveLength(2)
    expect(cards.every((card) => card.fen.startsWith('rnbqkbnr'))).toBe(true)
    expect(cards.every((card) => card.solutionUci === 'e2e4')).toBe(true)
    expect(cards[0]?.theme).toBe('vidlička')
  })

  it('keeps the schedule when the same card is generated again', () => {
    const original = cardsFromMoves([mistake(0, 'vidlička'), mistake(4, 'vidlička')], NOW)
    const reviewed = original.map((card) => (card.ply === 0 ? { ...card, ...reviewSm2(card, 'good', NOW) } : card))
    const again = cardsFromMoves([mistake(0, 'vidlička'), mistake(4, 'vidlička')], NOW + DAY)
    const merged = mergeCards(reviewed, again)
    expect(merged.find((item) => item.ply === 0)?.intervalDays).toBe(1)
    expect(dueCards(merged, NOW).map((item) => item.ply)).toEqual([4])
  })
})

describe('SM-2', () => {
  it('brings a missed card back sooner than a remembered one', () => {
    const start = { repetition: 2, intervalDays: 6, ease: 2.5, dueAt: NOW }
    const again = reviewSm2(start, 'again', NOW)
    const good = reviewSm2(start, 'good', NOW)
    expect(again.dueAt).toBeLessThan(good.dueAt)
    expect(again.repetition).toBe(0)
    expect(again.ease).toBeGreaterThanOrEqual(1.3)
    expect(good.intervalDays).toBeGreaterThan(again.intervalDays)
  })
})

describe('mistake trend', () => {
  it('says there is not enough data, then that a theme is shrinking', () => {
    const thin: Rollup = { gameId: 'a', updatedAt: 1, userMoves: 3, themes: { vidlička: 2 } }
    expect(trendLines([thin, { ...thin, gameId: 'b', updatedAt: 2 }])[0]).toContain('málo dat')
    const older: Rollup = { gameId: 'a', updatedAt: 1, userMoves: 10, themes: { vidlička: 4 } }
    const newer: Rollup = { gameId: 'b', updatedAt: 2, userMoves: 10, themes: { vidlička: 1 } }
    expect(foldRollups([older], { ...newer, gameId: 'a' })).toHaveLength(1)
    expect(trendLines([older, newer])[0]).toContain('opakuje se míň')
  })
})
