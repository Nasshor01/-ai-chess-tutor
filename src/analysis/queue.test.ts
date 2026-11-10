import { describe, expect, it } from 'vitest'
import type { MoveRecord } from '../storage/types'
import { configureAnalysis, startAnalysis, whenAnalysisIdle } from './queue'
import type { AnalysisSettings } from './types'

const settings: AnalysisSettings = { depth: 8, multipv: 1, movetime: 100 }
const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function move(ply: number, uci: string, fenBefore: string): MoveRecord {
  return { gameId: 'g', ply, fenBefore, uci, san: uci, byUser: ply % 2 === 0 }
}

describe('analysis queue', () => {
  it('classifies moves, caches the position, and pauses before the next one', async () => {
    const moves = [move(0, 'e2e4', start)]
    const cache = new Map<string, string>()
    let searches = 0
    let busy = false
    configureAnalysis({
      search: async (fen) => {
        searches += 1
        while (busy) await new Promise((resolve) => setTimeout(resolve, 1))
        const cp = fen.split(' ')[1] === 'b' ? -20 : 20
        return { bestMove: 'e2e4', lines: [{ multipv: 1, depth: 8, cp, mate: null, pv: ['e2e4'] }] }
      },
      cancelSearch: () => undefined,
      loadMoves: async () => moves,
      saveMove: async (saved) => {
        moves[saved.ply] = saved
      },
      readCache: async (key) => cache.get(key) ?? null,
      writeCache: async (key, _fen, _settings, payload) => {
        cache.set(key, payload)
      },
      saveJob: async () => undefined,
      gameBusy: () => busy,
      wait: () => new Promise((resolve) => setTimeout(resolve, 1)),
    })
    busy = true
    startAnalysis('g', settings)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(searches).toBe(0)
    busy = false
    await whenAnalysisIdle()
    expect(moves[0]?.category?.startsWith('best')).toBe(true)
    expect(moves[0]?.cpLoss).toBe(0)
    expect(moves[0]?.phase).toBe('opening')
    expect(typeof moves[0]?.winLoss).toBe('number')
    expect(cache.size).toBeGreaterThan(0)
    const searched = searches
    startAnalysis('other', settings)
    await whenAnalysisIdle()
    expect(searches).toBe(searched)
  })
})
