import { analyst } from '../engine/engines'
import { readAnalysisCache, readAnalysisJob, writeAnalysisCache, writeAnalysisJob } from '../storage/analysisCache'
import { movesFor, saveMove } from '../storage/games'
import { configureAnalysis, startAnalysis } from '../analysis/queue'
import type { AnalysisJob, AnalysisSettings } from '../analysis/types'

let installed = false

export function installAnalysis(): void {
  if (installed) return
  installed = true
  configureAnalysis({
    search: (fen, settings) =>
      analyst
        .analyze(fen, { depth: settings.depth, multipv: settings.multipv, movetime: settings.movetime, skill: 20 })
        .then((result) => ({ bestMove: result.bestMove, lines: result.lines })),
    cancelSearch: () => analyst.cancelAll(),
    loadMoves: (gameId) => movesFor(gameId),
    saveMove: (move) => saveMove(move),
    readCache: async (key) => (await readAnalysisCache(key))?.payload ?? null,
    writeCache: async (key, fen, settings, payload) => {
      await writeAnalysisCache({
        key,
        fen,
        depth: settings.depth,
        multipv: settings.multipv,
        movetime: settings.movetime,
        skill: 20,
        payload,
        updatedAt: Date.now(),
      })
    },
    saveJob: (job) => writeAnalysisJob(job),
  })
}

function isJob(value: unknown): value is AnalysisJob {
  if (typeof value !== 'object' || value === null) return false
  const job = value as AnalysisJob
  return typeof job.gameId === 'string' && typeof job.nextPly === 'number' && job.settings !== undefined
}

/** Continues a running analysis after a reload. A paused job stays paused. */
export async function resumeStoredAnalysis(): Promise<void> {
  installAnalysis()
  const stored = await readAnalysisJob()
  if (!isJob(stored) || stored.status !== 'running') return
  startAnalysis(stored.gameId, stored.settings, stored.nextPly)
}

export function beginAnalysis(gameId: string, settings: AnalysisSettings, nextPly?: number): void {
  installAnalysis()
  startAnalysis(gameId, settings, nextPly)
}
