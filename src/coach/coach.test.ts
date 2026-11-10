import { describe, expect, it } from 'vitest'
import { lessonsFromMoves, type ReviewedMove } from './lessons'
import { lossBudget, teachingMove } from './teach'

const OPEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'

function move(partial: Partial<ReviewedMove> & Pick<ReviewedMove, 'ply' | 'san'>): ReviewedMove {
  return { byUser: true, cpLoss: null, category: null, phase: 'middlegame', ...partial }
}

describe('game lessons', () => {
  it('does not invent a review before the game is analysed', () => {
    const lesson = lessonsFromMoves([move({ ply: 0, san: 'e4' })])
    expect(lesson.analyzed).toBe(false)
    expect(lesson.mistakes).toEqual([])
    expect(lesson.strength).toBeNull()
    expect(lesson.goal).toBeNull()
  })

  it('keeps the three worst mistakes, one strong phase and a goal from the motif', () => {
    const moves: ReviewedMove[] = [
      move({ ply: 0, san: 'e4', cpLoss: 10, category: 'good', phase: 'opening' }),
      move({ ply: 2, san: 'Nf3', cpLoss: 5, category: 'best', phase: 'opening' }),
      move({ ply: 4, san: 'Bc4', cpLoss: 8, category: 'excellent', phase: 'opening' }),
      move({ ply: 6, san: 'd3', cpLoss: 12, category: 'good', phase: 'opening' }),
      move({ ply: 10, san: 'Qh5', cpLoss: 40, category: 'mistake|vidlička', phase: 'middlegame' }),
      move({ ply: 12, san: 'Qf3', cpLoss: 90, category: 'blunder|figura zůstala viset', phase: 'middlegame' }),
      move({ ply: 14, san: 'a3', cpLoss: 30, category: 'mistake', phase: 'middlegame' }),
      move({ ply: 16, san: 'h3', cpLoss: 20, category: 'inaccuracy', phase: 'middlegame' }),
      move({ ply: 20, san: 'Rd1', cpLoss: 80, category: 'blunder|figura zůstala viset', phase: 'endgame' }),
    ]
    const lesson = lessonsFromMoves(moves)
    expect(lesson.mistakes.map((item) => item.label)).toEqual(['7. Qf3', '11. Rd1', '6. Qh5'])
    expect(lesson.strength?.text).toContain('zahájení')
    expect(lesson.goal?.text).toContain('nic nekryje')
    expect(lesson.mistakes).toHaveLength(3)
  })
})

describe('teaching move', () => {
  const lines = [
    { uci: 'd1h5', cp: 40, mate: null },
    { uci: 'g1f3', cp: 25, mate: null },
  ]

  it('gives a beginner the calmer move inside the budget', () => {
    expect(lossBudget(1000)).toBe(80)
    const choice = teachingMove({ fen: OPEN, lines, elo: 1000, weakness: null })
    expect(choice?.uci).toBe('g1f3')
    expect(choice?.reason.length).toBeGreaterThan(10)
  })

  it('gives a stronger player the engine move when both moves fit the budget', () => {
    expect(lossBudget(1900)).toBe(30)
    const choice = teachingMove({ fen: OPEN, lines, elo: 1900, weakness: null })
    expect(choice?.uci).toBe('d1h5')
  })

  it('drops a calm move that loses more than the learner can use', () => {
    const choice = teachingMove({
      fen: OPEN,
      lines: [
        { uci: 'd1h5', cp: 40, mate: null },
        { uci: 'g1f3', cp: -80, mate: null },
      ],
      elo: 1000,
      weakness: null,
    })
    expect(choice?.uci).toBe('d1h5')
  })

  it('still prefers development when that is the named weakness', () => {
    const choice = teachingMove({ fen: OPEN, lines, elo: 1900, weakness: 'development' })
    expect(choice?.uci).toBe('g1f3')
  })
})
