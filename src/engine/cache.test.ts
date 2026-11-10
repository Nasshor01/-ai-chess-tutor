import { describe, expect, it } from 'vitest'
import { cacheSatisfies, findCached, type AnalysisCacheEntry } from './cache'
import type { EngineResult } from './types'

function entry(patch: Partial<AnalysisCacheEntry>): AnalysisCacheEntry {
  const result: EngineResult = {
    fen: 'start',
    bestMove: 'e2e4',
    lines: [],
    depth: patch.achievedDepth ?? 13,
    requestedDepth: patch.requestedDepth ?? 13,
    multipv: patch.multipv ?? 3,
  }
  return {
    fen: 'start',
    requestedDepth: 13,
    achievedDepth: 13,
    multipv: 3,
    movetime: 1800,
    skill: 20,
    result,
    ...patch,
  }
}

const request = {
  fen: 'start',
  depth: 13,
  multipv: 3,
  movetime: 1800 as number | null,
  skill: 20,
}

describe('analysis cache', () => {
  it('reuses the identical request even when movetime stopped it early', () => {
    const cached = entry({ requestedDepth: 18, achievedDepth: 14, movetime: 2500, multipv: 1 })
    expect(cacheSatisfies(cached, { ...request, depth: 18, multipv: 1, movetime: 2500 })).toBe(true)
  })

  it('does not let a shallower search answer MATE_RECHECK', () => {
    const mateAnalysis = entry({ requestedDepth: 18, achievedDepth: 16, movetime: 2500, multipv: 1 })
    const recheck = { fen: 'start', depth: 24, multipv: 1, movetime: 5000, skill: 20 }
    expect(cacheSatisfies(mateAnalysis, recheck)).toBe(false)
    expect(findCached([mateAnalysis], recheck)).toBeNull()
  })

  it('does not treat a time-cut search as deep enough for a smaller depth it never reached', () => {
    const cut = entry({ requestedDepth: 13, achievedDepth: 8, movetime: 1800 })
    expect(cacheSatisfies(cut, { ...request, depth: 10 })).toBe(false)
  })

  it('serves a finished deeper search to a shallower request of the same skill', () => {
    const done = entry({ requestedDepth: 13, achievedDepth: 13, multipv: 3, movetime: 1800 })
    expect(cacheSatisfies(done, { ...request, depth: 10, multipv: 1, movetime: 1800 })).toBe(true)
  })

  it('never mixes skill levels', () => {
    const full = entry({ skill: 20, achievedDepth: 14, requestedDepth: 14 })
    expect(cacheSatisfies(full, { ...request, depth: 6, multipv: 1, movetime: 500, skill: 6 })).toBe(false)
  })

  it('does not reuse a short unfinished search for a longer time budget', () => {
    const cut = entry({ requestedDepth: 14, achievedDepth: 6, movetime: 200, multipv: 1, skill: 0 })
    expect(cacheSatisfies(cut, { fen: 'start', depth: 6, multipv: 1, movetime: 1200, skill: 0 })).toBe(false)
  })
})
