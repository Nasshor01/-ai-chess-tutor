import type { Color } from 'chess.js'
import { cpFor, winChanceFor } from '../chess/utils'
import type { Score } from '../engine/types'
import { qualityFromLoss } from '../tutor/classify'
import type { MoveQuality } from '../tutor/types'

export interface MoveAssessment {
  /** Centipawns the mover gave away. Never negative. */
  cpLoss: number
  /** Mover's win probability before the move, in percent. */
  winBefore: number
  /** Mover's win probability after the move, in percent. */
  winAfter: number
  /** Drop in the mover's win probability, in percentage points. Never negative. */
  winLoss: number
  quality: MoveQuality
}

/** Scores are White's point of view, the same way the eval bar stores them. */
export function assessMove(args: {
  before: Score
  after: Score
  color: Color
  playedUci: string
  bestUci: string | null
}): MoveAssessment {
  const winBefore = winChanceFor(args.before, args.color)
  const winAfter = winChanceFor(args.after, args.color)
  const winLoss = Math.max(0, winBefore - winAfter)
  const cpLoss = Math.max(0, cpFor(args.before, args.color) - cpFor(args.after, args.color))
  const isBest = args.bestUci !== null && args.playedUci === args.bestUci
  return { cpLoss, winBefore, winAfter, winLoss, quality: qualityFromLoss(winLoss, isBest) }
}
