import { StockfishEngine } from './stockfish'

/** Full-strength engine used by the tutor for analysis and hints. */
export const analyst = new StockfishEngine()

/** Strength-limited engine that plays Black. */
export const opponent = new StockfishEngine()

/** Separate worker for Calculator Mode, so its searches never delay the tutor's comments. Started on first use. */
export const calculatorEngine = new StockfishEngine()

export function warmUpEngines(): Promise<void[]> {
  return Promise.all([analyst.init(), opponent.init()])
}
