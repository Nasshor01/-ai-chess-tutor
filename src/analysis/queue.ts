import { Chess } from 'chess.js'
import { lineToScore, parseUci } from '../chess/utils'
import type { EngineLine } from '../engine/types'
import type { MoveRecord } from '../storage/types'
import { assessMove } from './assess'
import { gameSearchBusy } from './busy'
import { reliableMotifs } from './motifs'
import { phaseOf } from './phase'
import { analysisKey, type AnalysisJob, type AnalysisSettings } from './types'

export interface PositionResult {
  bestMove: string | null
  lines: EngineLine[]
}

export interface AnalysisDeps {
  search: (fen: string, settings: AnalysisSettings) => Promise<PositionResult>
  cancelSearch: () => void
  loadMoves: (gameId: string) => Promise<MoveRecord[]>
  saveMove: (move: MoveRecord) => Promise<void>
  readCache: (key: string) => Promise<string | null>
  writeCache: (key: string, fen: string, settings: AnalysisSettings, payload: string) => Promise<void>
  saveJob: (job: AnalysisJob | null) => Promise<void>
  /** True while the live game needs the engine. Defaults to the shared-worker flag. */
  gameBusy?: () => boolean
  wait?: () => Promise<void>
}

interface Snapshot {
  job: AnalysisJob | null
  waiting: boolean
}

const listeners = new Set<() => void>()
let deps: AnalysisDeps | null = null
let job: AnalysisJob | null = null
let waiting = false
let inFlight = false
let pauseRequested = false
let stopRequested = false
let loop: Promise<void> | null = null

function emit(): void {
  for (const listener of listeners) listener()
}

export function analysisSnapshot(): Snapshot {
  return { job, waiting }
}

export function subscribeAnalysis(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function configureAnalysis(next: AnalysisDeps): void {
  deps = next
}

export function startAnalysis(gameId: string, settings: AnalysisSettings, fromPly?: number): void {
  if (!deps) return
  pauseRequested = false
  stopRequested = false
  const previous = job
  const kept = previous?.gameId === gameId && previous.status !== 'done' ? previous.nextPly : 0
  job = { gameId, settings, nextPly: fromPly ?? kept, status: 'running' }
  void kick()
}

export function pauseAnalysis(): void {
  pauseRequested = true
  emit()
}

export function cancelAnalysis(): void {
  stopRequested = true
  pauseRequested = false
  if (inFlight) deps?.cancelSearch()
  emit()
}

export function whenAnalysisIdle(): Promise<void> {
  return loop ?? Promise.resolve()
}

function kick(): Promise<void> {
  if (loop) return loop
  loop = run().finally(() => {
    loop = null
  })
  return loop
}

async function run(): Promise<void> {
  const current = deps
  const initial = job
  if (!current || !initial) return
  let cursor: AnalysisJob = initial
  const moves = await current.loadMoves(cursor.gameId)
  while (cursor.nextPly < moves.length) {
    if (stopRequested) {
      job = null
      await current.saveJob(null)
      emit()
      return
    }
    if (pauseRequested) {
      cursor = { gameId: cursor.gameId, settings: cursor.settings, nextPly: cursor.nextPly, status: 'paused' }
      job = cursor
      await current.saveJob(cursor)
      emit()
      return
    }
    const busy = current.gameBusy ?? gameSearchBusy
    if (busy()) {
      waiting = true
      emit()
      await (current.wait ?? waitBriefly)()
      waiting = false
      continue
    }
    const move = moves[cursor.nextPly]
    if (!move) break
    const afterFen = fenAfter(move.fenBefore, move.uci)
    if (!afterFen) {
      cursor = { gameId: cursor.gameId, settings: cursor.settings, nextPly: cursor.nextPly + 1, status: 'running' }
      job = cursor
      continue
    }
    const before = await evaluate(current, move.fenBefore, cursor.settings)
    if (!before) continue
    const after = await evaluate(current, afterFen, cursor.settings)
    if (!after) continue
    const color = move.fenBefore.split(' ')[1] === 'b' ? 'b' : 'w'
    const assessment = assessMove({
      before: before.score,
      after: after.score,
      color,
      playedUci: move.uci,
      bestUci: before.bestMove,
    })
    await current.saveMove({
      ...move,
      evalBefore: before.score.cp,
      evalAfter: after.score.cp,
      cpLoss: Math.round(assessment.cpLoss),
      category: [assessment.quality, ...reliableMotifs(move.fenBefore, move.uci)].join('|'),
      phase: phaseOf(move.fenBefore),
      winLoss: Math.round(assessment.winLoss * 10) / 10,
      bestUci: before.bestMove,
    })
    const ply = cursor.nextPly + 1
    cursor = {
      gameId: cursor.gameId,
      settings: cursor.settings,
      nextPly: ply,
      status: ply >= moves.length ? 'done' : 'running',
    }
    job = cursor
    await current.saveJob(cursor)
    emit()
  }
}

async function evaluate(
  current: AnalysisDeps,
  fen: string,
  settings: AnalysisSettings,
): Promise<{ score: ReturnType<typeof lineToScore>; bestMove: string | null } | null> {
  const key = analysisKey(fen, settings)
  const cached = await current.readCache(key)
  if (cached) {
    try {
      const parsed: unknown = JSON.parse(cached)
      if (isCached(parsed)) return parsed
    } catch {
      // A broken cache row is searched again.
    }
  }
  inFlight = true
  emit()
  try {
    const result = await current.search(fen, settings)
    if (stopRequested || pauseRequested || (current.gameBusy ?? gameSearchBusy)()) return null
    const score = lineToScore(result.lines[0], fen)
    const payload = JSON.stringify({ score, bestMove: result.bestMove })
    await current.writeCache(key, fen, settings, payload)
    return { score, bestMove: result.bestMove }
  } catch (error) {
    if (error instanceof Error && error.name === 'EngineCancelledError') return null
    throw error
  } finally {
    inFlight = false
    emit()
  }
}

function isCached(value: unknown): value is { score: { cp: number; mate: number | null }; bestMove: string | null } {
  if (typeof value !== 'object' || value === null) return false
  const record = value as { score?: { cp?: unknown; mate?: unknown }; bestMove?: unknown }
  return typeof record.score?.cp === 'number' && (record.bestMove === null || typeof record.bestMove === 'string')
}

function fenAfter(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen)
    chess.move(parseUci(uci))
    return chess.fen()
  } catch {
    return null
  }
}

function waitBriefly(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 40))
}
