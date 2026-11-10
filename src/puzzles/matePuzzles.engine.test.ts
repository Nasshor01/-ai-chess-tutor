import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NodeEngine } from '../test/nodeEngine'
import { MATE_PUZZLES } from './matePuzzles'

let engine: NodeEngine

beforeAll(async () => {
  engine = new NodeEngine()
  await engine.ready()
}, 30_000)

afterAll(() => engine.quit())

describe('mate puzzles against Stockfish', () => {
  it.each(MATE_PUZZLES.map((p) => [p.id, p] as const))(
    '%s: Stockfish confirms forced mate in exactly N',
    async (_, puzzle) => {
      // Sacrificial lines (smothered mate) are only found as the shortest mate from depth ~23 on.
      const result = await engine.analyze(puzzle.fen, 30, 1)
      expect(result.lines[0].mate).toBe(puzzle.mateIn)
    },
    30_000,
  )
})
