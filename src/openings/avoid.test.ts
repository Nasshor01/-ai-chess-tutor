import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { surpriseAvoid } from './avoid'
import { buildBook, type OpeningRecord } from './book/book'

const sample: OpeningRecord[] = [
  { eco: 'C20', name: 'Open Game', pgn: '1. e4 e5', epd: '' },
  { eco: 'B90', name: 'Sicilian Defense: Najdorf Variation', pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6', epd: '' },
]

describe('surprise avoid set', () => {
  it('includes a reached opening and a tried id', () => {
    const book = buildBook(sample)
    const start = new Chess().fen()
    const avoid = surpriseAvoid(book, [{ userColor: 'w', result: '1-0', startFen: start, uci: ['e2e4', 'e7e5'] }], ['B90:Sicilian Defense: Najdorf Variation'])
    expect(avoid.has('C20:Open Game')).toBe(true)
    expect(avoid.has('B90:Sicilian Defense: Najdorf Variation')).toBe(true)
  })
})
