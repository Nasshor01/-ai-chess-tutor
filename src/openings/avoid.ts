import { Chess } from 'chess.js'
import { playedOpeningIds, positionKey, type Book, type PlayedGame } from './book/book'
import { OPENINGS } from './openings'

/** Openings already seen in saved games, tried in training, or matching a tried curated line. */
export function surpriseAvoid(book: Book, games: readonly PlayedGame[], tried: readonly string[]): Set<string> {
  const avoid = playedOpeningIds(book, games)
  for (const id of tried) avoid.add(id)
  const wanted = new Set(tried)
  for (const curated of OPENINGS) {
    if (!wanted.has(curated.id)) continue
    const chess = new Chess()
    let legal = true
    for (const move of curated.moves) {
      try {
        chess.move(move.san)
      } catch {
        legal = false
        break
      }
    }
    if (!legal) continue
    const key = positionKey(chess.fen())
    for (const entry of book.entries) {
      if (entry.epd === key) avoid.add(entry.id)
    }
  }
  return avoid
}
