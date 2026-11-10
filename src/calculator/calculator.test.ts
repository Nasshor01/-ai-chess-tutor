import { Chess, type Move } from 'chess.js'
import { describe, expect, it } from 'vitest'
import type { EngineLine, EngineResult } from '../engine/types'
import { parseUci, toUci } from '../chess/utils'
import { branchText, calculate, type Analyze } from './calculator'

/** Builds a search result from UCI moves. Each entry is the side-to-move score, like a real UCI engine. */
function scripted(rootFen: string, root: Array<{ uci: string; cp?: number; mate?: number; pv?: string[] }>): Analyze {
  return async (fen) => {
    const chess = new Chess(fen)
    const listed = fen === rootFen ? root : null
    const entries: Array<{ uci: string; cp?: number; mate?: number; pv?: string[] }> =
      listed ??
      chess
        .moves({ verbose: true })
        .filter((move) => move.captured !== 'k')
        .slice(0, 3)
        .map((move, index) => ({ uci: toUci(move), cp: 20 - index * 30 }))
    const lines: EngineLine[] = entries.map((entry, index) => {
      const board = new Chess(fen)
      board.move(parseUci(entry.uci))
      const answer = board.moves({ verbose: true })[0]
      return {
        multipv: index + 1,
        depth: 8,
        cp: entry.mate != null ? null : (entry.cp ?? 0),
        mate: entry.mate ?? null,
        pv: entry.pv ?? [entry.uci, ...(answer ? [toUci(answer)] : [])],
      }
    })
    const result: EngineResult = { fen, bestMove: lines[0]?.pv[0] ?? null, lines, depth: 8, requestedDepth: 8, multipv: lines.length }
    return result
  }
}

function play(sans: string[]): { fen: string; moves: Move[] } {
  const chess = new Chess()
  const moves = sans.map((san) => chess.move(san))
  return { fen: chess.fen(), moves }
}

describe('calculate (scripted engine)', () => {
  it('mixes a sensible move, a human inaccuracy and a real mistake', async () => {
    const { fen, moves } = play(['e4', 'e5'])
    const result = await calculate(
      fen,
      moves,
      scripted(fen, [
        { uci: 'g1f3', cp: 35 },
        { uci: 'd2d4', cp: 32 },
        { uci: 'b1c3', cp: 28 },
        { uci: 'f1c4', cp: 30 },
        { uci: 'd1h5', cp: -40 },
        { uci: 'f2f3', cp: -220 },
        { uci: 'e1e2', cp: -500 },
      ]),
    )
    expect(result).not.toBeNull()
    const [good, average, bad] = result!.options
    expect(result!.options.map((option) => option.label)).toEqual([
      'Tah A – rozumný',
      'Tah B – průměrný',
      'Tah C – riskantní / chybný',
    ])
    expect(new Set(result!.options.map((option) => option.uci)).size).toBe(3)
    expect(['Jf3', 'd4', 'Jc3', 'Sc4']).toContain(good.san)
    expect(good.loss ?? 0).toBeLessThanOrEqual(90)
    expect(average.san).not.toBe(good.san)
    expect(['Dh5', 'f3', 'a3', 'h3', 'Ja3', 'Jh3', 'De2']).toContain(average.san)
    expect(['Sa6', 'f3', 'Ke2']).toContain(bad.san)
    expect(bad.san).not.toBe(average.san)
    expect(branchText(good)).toMatch(/^Černý: /)
    expect(good.preview.length).toBeGreaterThanOrEqual(2)
    expect(result!.turnText).toBe('Na tahu je bílý')
    expect(result!.finish).toBeNull()
    if (bad.san === 'Sa6') expect(branchText(bad)).toContain('Jxa6')
  })

  it('prefers a sound move that matches how the player has been developing', async () => {
    const chess = new Chess()
    const ownMoves = ['e4', 'e5', 'Bc4', 'Nc6', 'Bb3', 'Nf6', 'Ba4', 'Be7', 'd3', 'd6']
      .map((san) => chess.move(san))
      .filter((_, index) => index % 2 === 0)
    const { fen, moves } = play(['e4', 'e5'])
    const result = await calculate(
      fen,
      moves,
      scripted(fen, [
        { uci: 'g1f3', cp: 35 },
        { uci: 'f1c4', cp: 30 },
        { uci: 'd2d4', cp: 32 },
        { uci: 'b1c3', cp: 28 },
        { uci: 'd1h5', cp: -40 },
        { uci: 'f2f3', cp: -220 },
      ]),
      () => false,
      ownMoves,
    )
    expect(result!.options[0].san).toBe('Sc4')
    expect(result!.note).toContain('střelce')
    expect(result!.options[0].loss ?? 0).toBeLessThanOrEqual(90)
  })

  it('offers moves for Black as well', async () => {
    const { fen, moves } = play(['e4'])
    const result = await calculate(
      fen,
      moves,
      scripted(fen, [
        { uci: 'e7e5', cp: 30 },
        { uci: 'c7c5', cp: 25 },
        { uci: 'g8f6', cp: 20 },
        { uci: 'b8a6', cp: -40 },
        { uci: 'f7f6', cp: -180 },
      ]),
    )
    const [good, , bad] = result!.options
    expect(result!.side).toBe('b')
    expect(['e5', 'c5', 'Jf6']).toContain(good.san)
    expect(bad.san).toBe('b5')
    expect(branchText(bad)).toContain('Sxb5')
    expect(bad.san).not.toBe(good.san)
    expect(branchText(bad)).toMatch(/^Bílý: /)
    expect(result!.turnText).toBe('Na tahu je černý')
    expect(result!.finish).toBeNull()
  })

  it('keeps the mate as the sensible move and lets the others miss it', async () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
    const chess = new Chess(fen)
    const others = chess
      .moves({ verbose: true })
      .filter((move) => move.san !== 'Rd8#')
      .slice(0, 4)
      .map((move) => ({ uci: toUci(move), cp: 80 }))
    const result = await calculate(fen, [], scripted(fen, [{ uci: 'd1d8', mate: 1 }, ...others]))
    expect(result!.finish).toEqual({ title: 'Dokonči partii', mateIn: 1 })
    expect(result!.options[0].label).toBe('Matová cesta')
    expect(result!.options[0].kind).toBe('mate')
    expect(result!.options[0].san).toBe('Vd8#')
    expect(result!.options[0].explanation.toLowerCase()).toContain('mat')
    expect(result!.options[2].san).not.toBe('Vd8#')
    expect(result!.options[2].kind).toBe('slow')
    expect(result!.note.toLowerCase()).toContain('mat')
  })

  it('plays the mating line out in the preview and offers a slower win beside it', async () => {
    const fen = '7k/8/5K2/8/8/8/8/R7 w - - 0 1'
    const chess = new Chess(fen)
    const others = chess
      .moves({ verbose: true })
      .filter((move) => toUci(move) !== 'f6g6')
      .slice(0, 4)
      .map((move) => ({ uci: toUci(move), cp: 400 }))
    const result = await calculate(
      fen,
      [],
      scripted(fen, [{ uci: 'f6g6', mate: 2, pv: ['f6g6', 'h8g8', 'a1a8'] }, ...others]),
    )
    expect(result!.finish).toEqual({ title: 'Dokonči partii', mateIn: 2 })
    expect(result!.options[0].label).toBe('Matová cesta')
    expect(result!.options[0].san).toBe('Kg6')
    expect(result!.options[0].previewSan.join(' ')).toContain('Va8#')
    expect(result!.options.map((option) => option.kind)).toEqual(['mate', 'practical', 'slow'])
    expect(result!.options.some((option) => option.san !== 'Kg6')).toBe(true)
  })

  it('switches to restricting moves when the win is clear but not yet a short mate', async () => {
    const fen = '6k1/8/8/8/8/8/6Q1/6K1 w - - 0 1'
    const result = await calculate(
      fen,
      [],
      scripted(fen, [
        { uci: 'g2g6', cp: 900 },
        { uci: 'g2g5', cp: 860 },
        { uci: 'g2a2', cp: 700 },
        { uci: 'g1f1', cp: 500 },
      ]),
    )
    expect(result!.finish).toEqual({ title: 'Dokonči partii', mateIn: null })
    expect(result!.options[0].label).toBe('Tah A – omez krále')
    expect(result!.options.map((option) => option.kind)).toEqual(['restrict', 'practical', 'slow'])
    expect(result!.options[2].explanation).toMatch(/Pořád/)
    expect(result!.note).toContain('Dokonči partii')
  })
})
