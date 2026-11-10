import { StockfishEngine } from './stockfish'
import { coreCount, preferSharedEngine } from './sharedTurn'

export { coreCount, preferSharedEngine } from './sharedTurn'

/** Full-strength engine used by the tutor for analysis and hints. */
export const analyst = new StockfishEngine()

/** Strength-limited engine that plays Black. */
export const opponent = new StockfishEngine()

/** Separate worker for Calculator Mode, so its searches never delay the tutor's comments. Started on first use. */
export const calculatorEngine = new StockfishEngine()

/** The engine that plays the opponent. On a weak device this is the analyst worker. */
export function playingEngine(): StockfishEngine {
  return preferSharedEngine(coreCount()) ? analyst : opponent
}

export function warmUpEngines(): Promise<void[]> {
  if (preferSharedEngine(coreCount())) return Promise.all([analyst.init()])
  return Promise.all([analyst.init(), opponent.init()])
}
