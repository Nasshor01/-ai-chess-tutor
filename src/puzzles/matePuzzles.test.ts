import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { MATE_PUZZLES, nextPuzzleId } from './matePuzzles'

describe('mate puzzles', () => {
  it('has 15–25 puzzles with unique ids and every mate length', () => {
    expect(MATE_PUZZLES.length).toBeGreaterThanOrEqual(15)
    expect(new Set(MATE_PUZZLES.map((p) => p.id)).size).toBe(MATE_PUZZLES.length)
    expect(new Set(MATE_PUZZLES.map((p) => p.mateIn))).toEqual(new Set([2, 3, 4]))
  })

  it.each(MATE_PUZZLES.map((p) => [p.id, p] as const))('%s: legal position, solution ends in mate', (_, puzzle) => {
    const chess = new Chess(puzzle.fen)
    expect(chess.turn()).toBe('w')
    const asBlack = puzzle.fen.split(' ')
    asBlack[1] = 'b'
    asBlack[3] = '-'
    expect(new Chess(asBlack.join(' '), { skipValidation: true }).inCheck(), 'black must not already be in check').toBe(false)
    puzzle.solution.forEach((san) => chess.move(san))
    expect(chess.isCheckmate()).toBe(true)
    expect(puzzle.solution.length).toBe(puzzle.mateIn * 2 - 1)
  })

  it('cycles to the next unsolved puzzle', () => {
    const [first, second, third] = MATE_PUZZLES
    expect(nextPuzzleId(first.id, [])).toBe(second.id)
    expect(nextPuzzleId(first.id, [second.id])).toBe(third.id)
  })
})
