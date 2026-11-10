export interface AnalysisSettings {
  depth: number
  multipv: number
  movetime: number
}

export interface AnalysisJob {
  gameId: string
  settings: AnalysisSettings
  /** Next ply to classify. Equal to the move count once every move is done. */
  nextPly: number
  status: 'running' | 'paused' | 'done'
}

export const DEFAULT_ANALYSIS: AnalysisSettings = { depth: 12, multipv: 1, movetime: 800 }

export function analysisKey(fen: string, settings: AnalysisSettings): string {
  return `${fen}|${settings.depth}|${settings.multipv}|${settings.movetime}|20`
}
