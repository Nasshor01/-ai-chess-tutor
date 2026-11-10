import { Chess } from 'chess.js'
import { parseUci } from '../chess/utils'
import { analyzeMove } from '../tutor/features'

/**
 * Only motifs that features.ts computes from attacks, not from a guess.
 * A fork is two or more valuable targets. A hanging piece is the moved piece
 * left en prise. Pins and skewers are not reported, because the feature list
 * does not detect them.
 */
export function reliableMotifs(fenBefore: string, uci: string): string[] {
  const chess = new Chess(fenBefore)
  let move
  try {
    move = chess.move(parseUci(uci))
  } catch {
    return []
  }
  const facts = analyzeMove(fenBefore, move, [])
  const motifs: string[] = []
  if (facts.fork && facts.fork.length >= 2) motifs.push('vidlička')
  if (facts.hangingAfter.some((piece) => piece.square === move.to)) motifs.push('figura zůstala viset')
  return motifs
}
