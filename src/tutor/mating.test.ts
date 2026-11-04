import { Chess, type Move } from 'chess.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NodeEngine } from '../test/nodeEngine'
import { getPuzzle } from '../puzzles/matePuzzles'
import { buildMateComment, kingEscapeSquares } from './mating'

let engine: NodeEngine

beforeAll(async () => {
  engine = new NodeEngine()
  await engine.ready()
}, 30_000)

afterAll(() => engine.quit())

async function judge(puzzleId: string, sans: string[]) {
  const puzzle = getPuzzle(puzzleId)!
  const chess = new Chess(puzzle.fen)
  const moves: Move[] = sans.map((san) => chess.move(san))
  const move = moves[moves.length - 1]
  const before = await engine.analyze(move.before, 18, 1)
  const afterBoard = new Chess(move.after)
  const after = afterBoard.isGameOver() ? null : await engine.analyze(move.after, 18, 1)
  return buildMateComment({ plyIndex: moves.length - 1, puzzle, move, history: moves.slice(0, -1), before, after, conceptSeen: {} })
}

describe('kingEscapeSquares', () => {
  it('counts squares behind the king on a checking line as attacked', () => {
    expect(kingEscapeSquares('7k/8/5K2/8/8/8/8/R7 b - - 0 1')).toEqual(['g8', 'h7'])
    expect(kingEscapeSquares('R6k/8/6K1/8/8/8/8/8 b - - 0 1')).toEqual([])
  })
})

describe('buildMateComment', () => {
  it('praises the solution and names the pattern on mate', async () => {
    const first = await judge('kr-2', ['Kg6'])
    expect(first.outcome).toBe('held')
    expect(first.comment.quality).toBe('best')
    expect(first.comment.reasons.join(' ')).toContain('stačí jediný tah')

    const mate = await judge('kr-2', ['Kg6', 'Kg8', 'Ra8#'])
    expect(mate.outcome).toBe('mated')
    expect(mate.comment.reasons[0]).toBe('Použil jsi vzor: Věž a král proti králi.')
  })

  it('flags a move that lets the king out and shows the correct continuation', async () => {
    const result = await judge('backrank-2', ['Re7'])
    expect(result.outcome).not.toBe('held')
    expect(result.comment.verdict).toBe('bad')
    expect(result.comment.better?.san).toBe('Vxe8+')
    expect(result.comment.better?.line).toContain('Vxe8#')
  })

  it('detects stalemate', async () => {
    const result = await judge('kq-2', ['Kg6+', 'Kg8', 'Qf6'])
    expect(result.outcome).toBe('stalemate')
    expect(result.comment.headline).toContain('Pat')
  })
})
