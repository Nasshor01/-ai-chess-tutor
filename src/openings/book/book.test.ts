import { readFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import {
  buildBook,
  continuationStats,
  continuations,
  lineTo,
  nameForPosition,
  positionKey,
  searchOpenings,
  surpriseOpening,
  type OpeningRecord,
} from './book'

const sample: OpeningRecord[] = [
  { eco: 'C20', name: 'Open Game', pgn: '1. e4 e5', epd: '' },
  { eco: 'C50', name: 'Italian', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4', epd: '' },
  { eco: 'C50', name: 'Italian via bishop', pgn: '1. e4 e5 2. Bc4 Nc6 3. Nf3', epd: '' },
  { eco: 'C23', name: 'Bishop Opening', pgn: '1. e4 e5 2. Bc4', epd: '' },
  { eco: 'C50', name: 'Italian extended', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', epd: '' },
  { eco: 'B20', name: 'Sicilian Defense', pgn: '1. e4 c5', epd: '' },
  { eco: 'B90', name: 'Sicilian Defense: Najdorf Variation', pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6', epd: '' },
  { eco: 'E60', name: "King's Indian Defense", pgn: '1. d4 Nf6 2. c4 g6', epd: '' },
  { eco: 'C20', name: 'Open Game duplicate title', pgn: '1. e4 e5', epd: '' },
  { eco: 'C20', name: 'Open Game', pgn: '1. e4 e5 2. Nf3 Nc6', epd: '' },
]

function fenAfter(pgn: string): string {
  const chess = new Chess()
  chess.loadPgn(pgn)
  return chess.fen()
}

describe('opening book', () => {
  const book = buildBook(sample)

  it('merges transpositions onto one position and keeps the longest name on the path', () => {
    const viaKnight = fenAfter('1. e4 e5 2. Nf3 Nc6 3. Bc4')
    const viaBishop = fenAfter('1. e4 e5 2. Bc4 Nc6 3. Nf3')
    expect(positionKey(viaKnight)).toBe(positionKey(viaBishop))
    expect(nameForPosition(book, viaKnight)).toBe('Italian')
    expect(nameForPosition(book, fenAfter('1. e4 e5'))).toBe('Open Game')
    expect(nameForPosition(book, fenAfter('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5'))).toBe('Italian extended')
  })

  it('returns only legal book moves and counts the variations under them', () => {
    const afterE4E5 = fenAfter('1. e4 e5')
    const moves = continuations(book, afterE4E5)
    const chess = new Chess(afterE4E5)
    const legal = new Set(chess.moves({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`))
    expect(moves.map((move) => move.san)).toEqual(['Bc4', 'Nf3'])
    for (const move of moves) expect(legal.has(move.uci)).toBe(true)
    expect(moves.find((move) => move.san === 'Nf3')?.variationsBelow).toBe(4)
    expect(moves.find((move) => move.san === 'Bc4')?.variationsBelow).toBe(4)
    expect(continuations(book, fenAfter('1. e4')).find((move) => move.san === 'e5')?.variationsBelow).toBe(6)
    expect(continuations(book, fenAfter('1. e4')).some((move) => move.uci === 'a2a5')).toBe(false)
  })

  it('names a square from a shorter opening even when the longer line was stored first', () => {
    const reversed = buildBook([
      { eco: 'C50', name: 'Italian extended', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5', epd: '' },
      { eco: 'C20', name: 'Open Game', pgn: '1. e4 e5', epd: '' },
    ])
    expect(nameForPosition(reversed, fenAfter('1. e4 e5 2. Nf3'))).toBe('Open Game')
    expect(nameForPosition(reversed, fenAfter('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5'))).toBe('Italian extended')
  })

  it('keeps the shortest line for a repeated name', () => {
    expect(lineTo(book, 'C20:Open Game')?.map((step) => step.san)).toEqual(['e4', 'e5'])
    expect(lineTo(book, 'C50:Italian')?.map((step) => step.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
  })

  it('searches Czech aliases and filters by ECO group', () => {
    expect(searchOpenings(book, 'Sicilská', null).map((entry) => entry.name)).toEqual([
      'Sicilian Defense',
      'Sicilian Defense: Najdorf Variation',
    ])
    expect(searchOpenings(book, 'Najdorf', 'B').map((entry) => entry.eco)).toEqual(['B90'])
    expect(searchOpenings(book, "King's Indian", 'E').map((entry) => entry.name)).toEqual(["King's Indian Defense"])
    expect(searchOpenings(book, "King's Indian", 'A')).toEqual([])
    expect(searchOpenings(book, '', 'D')).toEqual([])
  })

  it('counts the user moves from saved games and leaves the rest at zero', () => {
    const start = new Chess().fen()
    const stats = continuationStats(
      [
        { userColor: 'w', result: '1-0', startFen: start, uci: ['e2e4', 'c7c5'] },
        { userColor: 'w', result: '0-1', startFen: start, uci: ['e2e4', 'e7e5'] },
        { userColor: 'b', result: '0-1', startFen: start, uci: ['e2e4', 'c7c5'] },
      ],
      start,
      ['e2e4', 'd2d4'],
    )
    expect(stats.get('e2e4')).toEqual({ played: 2, wins: 1, draws: 0, losses: 1 })
    expect(stats.get('d2d4')).toEqual({ played: 0, wins: 0, draws: 0, losses: 0 })
    const black = continuationStats(
      [{ userColor: 'b', result: '0-1', startFen: start, uci: ['e2e4', 'c7c5'] }],
      fenAfter('1. e4'),
      ['c7c5'],
    )
    expect(black.get('c7c5')?.played).toBe(1)
    expect(black.get('c7c5')?.wins).toBe(1)
  })

  it('prefers an opening the player has not tried', () => {
    const picked = surpriseOpening(book, 'b', new Set(['C20:Open Game', 'C50:Italian', 'C50:Italian via bishop', 'C23:Bishop Opening', 'C50:Italian extended', 'B20:Sicilian Defense', 'E60:King\'s Indian Defense']), () => 0)
    expect(picked?.id).toBe('B90:Sicilian Defense: Najdorf Variation')
    expect(surpriseOpening(book, 'w', new Set(), () => 0)?.plies).toBeGreaterThan(0)
  })
})

describe('committed opening table', () => {
  it('contains the Lichess rows for Sicilian and King\'s Indian', () => {
    const records = JSON.parse(readFileSync(new URL('./data/openings.json', import.meta.url), 'utf8')) as OpeningRecord[]
    expect(records.length).toBeGreaterThan(3000)
    expect(records.some((row) => row.name.includes('Najdorf') && row.eco.startsWith('B'))).toBe(true)
    expect(records.some((row) => row.name.includes("King's Indian") && row.eco.startsWith('E'))).toBe(true)
    expect(records.every((row) => row.epd.split(' ').length === 4)).toBe(true)
  })
})
