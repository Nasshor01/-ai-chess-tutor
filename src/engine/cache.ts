import type { EngineResult } from './types'

interface SearchOptions {
  depth: number
  movetime?: number
  multipv?: number
}

/** Skill Level sent for tutor analysis. `analyze()` never searches at a reduced skill. */
export const FULL_SKILL = 20

export interface AnalysisRequest {
  fen: string
  depth: number
  multipv: number
  movetime: number | null
  skill: number
}

export interface AnalysisCacheEntry {
  fen: string
  requestedDepth: number
  achievedDepth: number
  multipv: number
  movetime: number | null
  skill: number
  result: EngineResult
}

export function analysisRequest(fen: string, options: SearchOptions, skill: number): AnalysisRequest {
  return {
    fen,
    depth: options.depth,
    multipv: options.multipv ?? 1,
    movetime: options.movetime ?? null,
    skill,
  }
}

function sameRequest(entry: AnalysisCacheEntry, request: AnalysisRequest): boolean {
  return (
    entry.fen === request.fen &&
    entry.requestedDepth === request.depth &&
    entry.multipv === request.multipv &&
    entry.movetime === request.movetime &&
    entry.skill === request.skill
  )
}

/**
 * A cached search may answer a new one when it is the same request (so a
 * time-capped search is not repeated forever) or when it actually reached
 * the depth being asked for. A shallower achieved depth never stands in for
 * a deeper request such as MATE_RECHECK, and a different skill never matches.
 */
export function cacheSatisfies(entry: AnalysisCacheEntry, request: AnalysisRequest): boolean {
  if (entry.fen !== request.fen || entry.skill !== request.skill) return false
  if (entry.multipv < request.multipv) return false
  if (sameRequest(entry, request)) return true
  if (entry.achievedDepth < request.depth) return false
  if (entry.movetime !== null && request.movetime !== null && entry.movetime < request.movetime && entry.achievedDepth < entry.requestedDepth) {
    return false
  }
  return true
}

export function findCached(entries: AnalysisCacheEntry[], request: AnalysisRequest): AnalysisCacheEntry | null {
  return entries.find((entry) => cacheSatisfies(entry, request)) ?? null
}
