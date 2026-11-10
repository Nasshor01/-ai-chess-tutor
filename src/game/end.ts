import type { Chess } from 'chess.js'
import type { GameEndReason, GameOutcome } from '../tutor/summary'
import type { PlayerColor } from './types'

/** Checkmate outcome is from the player's side. The default is white, which free play and mates already use. */
export function detectEnd(chess: Chess, player: PlayerColor = 'w'): { outcome: GameOutcome; reason: GameEndReason } | null {
  if (chess.isCheckmate()) return { outcome: chess.turn() === player ? 'loss' : 'win', reason: 'checkmate' }
  if (chess.isStalemate()) return { outcome: 'draw', reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { outcome: 'draw', reason: 'insufficient' }
  if (chess.isThreefoldRepetition()) return { outcome: 'draw', reason: 'repetition' }
  if (chess.isDraw()) return { outcome: 'draw', reason: 'fifty' }
  return null
}
