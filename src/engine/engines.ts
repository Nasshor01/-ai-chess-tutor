import { StockfishEngine } from './stockfish'

/** Full-strength engine used by the tutor for analysis and hints. */
export const analyst = new StockfishEngine()

/** Strength-limited engine that plays Black. */
export const opponent = new StockfishEngine()

/** Separate worker for Calculator Mode, so its searches never delay the tutor's comments. Started on first use. */
export const calculatorEngine = new StockfishEngine()

/** Four cores or fewer share one worker. The game search cancels background analysis. */
export function preferSharedEngine(cores: number | undefined): boolean {
  return typeof cores === 'number' && cores > 0 && cores <= 4
}

export function coreCount(): number | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator.hardwareConcurrency
}

/** The engine that plays the opponent. On a weak device this is the analyst worker. */
export function playingEngine(): StockfishEngine {
  return preferSharedEngine(coreCount()) ? analyst : opponent
}

export function warmUpEngines(): Promise<void[]> {
  if (preferSharedEngine(coreCount())) return Promise.all([analyst.init()])
  return Promise.all([analyst.init(), opponent.init()])
}
