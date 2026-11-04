import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import type { EngineLine, EngineResult } from '../engine/types'
import { buildComment } from './commentary'
import { conversionGuidance, isClearlyWinning, kingFlightSquares, mateDistance } from './conversion'

const KRK = '7k/8/5K2/8/8/8/8/R7 w - - 0 1'

function line(uci: string, score: { cp?: number; mate?: number }, pv: string[] = [uci]): EngineLine {
  return {
    multipv: 1,
    depth: 12,
    cp: score.mate != null ? null : (score.cp ?? 0),
    mate: score.mate ?? null,
    pv,
  }
}

function result(fen: string, lines: EngineLine[]): EngineResult {
  return { fen, bestMove: lines[0]?.pv[0] ?? null, lines, depth: 12, requestedDepth: 12, multipv: lines.length }
}

function comment(fen: string, san: string, before: EngineLine[], after: EngineLine[] | null) {
  const chess = new Chess(fen)
  const move = chess.move(san)
  return buildComment({
    plyIndex: 0,
    fenBefore: fen,
    move,
    history: [],
    byUser: true,
    before: result(fen, before),
    after: after ? result(move.after, after) : null,
    verbosity: 'high',
    conceptSeen: {},
  })
}

describe('winning detection', () => {
  it('treats a short mate, a decisive eval, or extra material as a win', () => {
    expect(mateDistance({ cp: 9997, mate: 3 }, 'w')).toBe(3)
    expect(mateDistance({ cp: -9997, mate: -3 }, 'b')).toBe(3)
    expect(mateDistance({ cp: 9997, mate: 3 }, 'b')).toBeNull()
    expect(isClearlyWinning({ cp: 30, mate: null }, 'w', KRK)).toBe(false)
    expect(isClearlyWinning({ cp: 9998, mate: 2 }, 'w', KRK)).toBe(true)
    expect(isClearlyWinning({ cp: 600, mate: null }, 'w', KRK)).toBe(true)
    expect(isClearlyWinning({ cp: 200, mate: null }, 'w', KRK)).toBe(true)
    expect(isClearlyWinning({ cp: 200, mate: null }, 'w', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false)
  })

  it('counts the black king flight squares from either side to move', () => {
    expect(kingFlightSquares('7k/8/5K2/8/8/8/8/R7 b - - 0 1', 'b')).toEqual(['g8', 'h7'])
    expect(kingFlightSquares(KRK, 'b')).toEqual(['g8', 'h7'])
  })
})

describe('conversion guidance', () => {
  it('tells the player to restrict the king and how many moves are left', () => {
    const chess = new Chess(KRK)
    const move = chess.move('Kg6')
    const guidance = conversionGuidance({
      fenBefore: KRK,
      move,
      evalBest: { cp: 9998, mate: 2 },
      evalMove: { cp: 9998, mate: 2 },
      evalFromBefore: true,
      bestSan: 'Kg6',
      byUser: true,
    })
    const text = guidance!.lines.join(' ')
    expect(text).toContain('Máš vyhranou pozici – teď omezuj krále.')
    expect(text).toContain('Tímhle tahem bereš soupeři útěková pole.')
    expect(text).toContain('Ještě jeden tah do matu, pokud budeš přesný.')
    expect(guidance!.missedFaster).toBe(false)
    expect(guidance!.mateIn).toBe(1)
  })

  it('keeps a slower win as a plan instead of a blunder', () => {
    const chess = new Chess(KRK)
    const move = chess.move('Ra2')
    const guidance = conversionGuidance({
      fenBefore: KRK,
      move,
      evalBest: { cp: 9998, mate: 2 },
      evalMove: { cp: 200, mate: null },
      evalFromBefore: true,
      bestSan: 'Kg6',
      byUser: true,
    })
    expect(guidance!.soften).toBe(true)
    expect(guidance!.missedFaster).toBe(true)
    expect(guidance!.headline).toContain('Pořád máš vyhranou pozici')
    expect(guidance!.lines.join(' ')).toContain('Rychlejší mat začínal tahem Kg6')
  })

  it('does not soften a move that throws the win', () => {
    const chess = new Chess(KRK)
    const move = chess.move('Ra2')
    const guidance = conversionGuidance({
      fenBefore: KRK,
      move,
      evalBest: { cp: 9998, mate: 2 },
      evalMove: { cp: -500, mate: null },
      evalFromBefore: true,
      bestSan: 'Kg6',
      byUser: true,
    })
    expect(guidance!.threw).toBe(true)
    expect(guidance!.soften).toBe(false)
    expect(guidance!.lines[0]).toContain('pouštíš vyhranou pozici')
  })
})

describe('tutor comments in a won position', () => {
  it('guides the mating move without calling it a mistake', () => {
    const played = comment(KRK, 'Kg6', [line('f6g6', { mate: 2 }, ['f6g6', 'h8g8', 'a1a8'])], [line('h8g8', { mate: -1 }, ['h8g8', 'a1a8'])])
    const text = [...played.reasons, ...played.threats.mine].join(' ')
    expect(text).toContain('Máš vyhranou pozici – teď omezuj krále.')
    expect(text).toMatch(/do matu/)
    expect(played.verdict).not.toBe('bad')
    expect(played.headline).not.toBe('Chyba.')
  })

  it('points a slower win back at the plan instead of saying chyba', () => {
    const slow = comment(
      KRK,
      'Ra2',
      [line('f6g6', { mate: 2 }, ['f6g6', 'h8g8', 'a1a8']), { ...line('a1a2', { cp: 180 }), multipv: 2 }],
      [line('h8h7', { cp: -200 })],
    )
    const text = [slow.headline, ...slow.reasons].join(' ')
    expect(slow.quality).not.toBe('mistake')
    expect(slow.quality).not.toBe('blunder')
    expect(slow.verdict).not.toBe('bad')
    expect(text).toMatch(/vyhranou pozici/)
    expect(text).toMatch(/Kg6|pomaleji|Pomalejší/)
  })

  it('still calls a thrown win a mistake', () => {
    const thrown = comment(KRK, 'Ra2', [line('f6g6', { mate: 2 }, ['f6g6', 'h8g8', 'a1a8'])], [line('h8h7', { mate: 1 })])
    expect(thrown.verdict).toBe('bad')
    expect(thrown.reasons.join(' ')).toContain('pouštíš vyhranou pozici')
  })

  it('leaves the mating move itself as mate', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
    const mate = comment(fen, 'Rd8#', [line('d1d8', { mate: 1 })], null)
    expect(mate.reasons[0]).toContain('Mat')
    expect(mate.verdict).not.toBe('bad')
  })
})
