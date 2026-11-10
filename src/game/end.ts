import type { Chess } from 'chess.js'
import type { GameEndReason, GameOutcome } from '../tutor/summary'

export function detectEnd(chess: Chess): { outcome: GameOutcome; reason: GameEndReason } | null {
  if (chess.isCheckmate()) return { outcome: chess.turn() === 'w' ? 'loss' : 'win', reason: 'checkmate' }
  if (chess.isStalemate()) return { outcome: 'draw', reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { outcome: 'draw', reason: 'insufficient' }
  if (chess.isThreefoldRepetition()) return { outcome: 'draw', reason: 'repetition' }
  if (chess.isDraw()) return { outcome: 'draw', reason: 'fifty' }
  return null
}
