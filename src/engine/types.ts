/** One principal variation as reported by the engine (score is from the side to move). */
export interface EngineLine {
  multipv: number
  depth: number
  cp: number | null
  mate: number | null
  /** Moves in UCI notation, e.g. "e2e4". */
  pv: string[]
}

export interface EngineResult {
  fen: string
  bestMove: string | null
  lines: EngineLine[]
  depth: number
  requestedDepth: number
  multipv: number
}

/** Evaluation normalised to White's point of view. */
export interface Score {
  cp: number
  /** Moves to mate; positive = White mates, negative = Black mates. */
  mate: number | null
}
