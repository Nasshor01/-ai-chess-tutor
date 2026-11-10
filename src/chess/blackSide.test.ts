import { Chess, type Color, type Move } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { assessMove } from '../analysis/assess'
import { branchText, calculate, type Analyze } from '../calculator/calculator'
import { reviewEvalY } from '../elo/charts'
import type { EngineLine, EngineResult } from '../engine/types'
import { linesFrom } from '../game/personalTurn'
import { lossBudget, teachingMove } from '../coach/teach'
import { createPersonalProvider } from '../personal/provider'
import { mulberry32 } from '../personal/rng'
import type { StyleMetric, StyleProfile } from '../profile/styleProfile'
import { buildComment } from '../tutor/commentary'
import { cpFor, describeScore, lineToScore } from './utils'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function mirrorSquare(square: string): string {
  return `${square[0]}${9 - Number(square[1])}`
}

function mirrorUci(uci: string): string {
  return `${mirrorSquare(uci.slice(0, 2))}${mirrorSquare(uci.slice(2, 4))}${uci.slice(4)}`
}

/** Swap colours and the side to move, and flip the board so each army stays on its own side. */
function mirrorFen(fen: string): string {
  const [board, turn, castle, ep, half, full] = fen.split(' ')
  const mirrored = (board ?? '')
    .split('/')
    .reverse()
    .map((row) => row.replace(/[pnbrqkPNBRQK]/g, (piece) => (piece.toUpperCase() === piece ? piece.toLowerCase() : piece.toUpperCase())))
    .join('/')
  const order = 'KQkq'
  const rights =
    !castle || castle === '-'
      ? '-'
      : [...castle]
          .map((bit) => (bit.toUpperCase() === bit ? bit.toLowerCase() : bit.toUpperCase()))
          .sort((a, b) => order.indexOf(a) - order.indexOf(b))
          .join('')
  const passed = !ep || ep === '-' ? '-' : `${ep[0]}${9 - Number(ep[1])}`
  return `${mirrored} ${turn === 'w' ? 'b' : 'w'} ${rights} ${passed} ${half ?? '0'} ${full ?? '1'}`
}

function scripted(rootFen: string, root: Array<{ uci: string; cp: number }>): Analyze {
  return async (fen) => {
    const chess = new Chess(fen)
    const entries =
      fen === rootFen
        ? root
        : chess
            .moves({ verbose: true })
            .slice(0, 3)
            .map((move, index) => ({ uci: `${move.from}${move.to}`, cp: 20 - index * 30 }))
    const lines: EngineLine[] = entries.map((entry, index) => ({
      multipv: index + 1,
      depth: 8,
      cp: entry.cp,
      mate: null,
      pv: [entry.uci],
    }))
    return { fen, bestMove: lines[0]?.pv[0] ?? null, lines, depth: 8, requestedDepth: 8, multipv: lines.length }
  }
}

function playUci(fen: string, uci: string): Move {
  const chess = new Chess(fen)
  const played = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined })
  if (!played) throw new Error(`illegal ${uci} on ${fen}`)
  return played
}

function comment(fen: string, san: string, beforeCp: number, beforeUci: string, afterCp: number) {
  const move = new Chess(fen).move(san)
  const before: EngineLine = { multipv: 1, depth: 12, cp: beforeCp, mate: null, pv: [beforeUci] }
  const after: EngineLine = { multipv: 1, depth: 12, cp: afterCp, mate: null, pv: ['a2a3'] }
  const pack = (fenNow: string, lines: EngineLine[]): EngineResult => ({
    fen: fenNow,
    bestMove: lines[0]?.pv[0] ?? null,
    lines,
    depth: 12,
    requestedDepth: 12,
    multipv: 1,
  })
  return buildComment({
    plyIndex: 1,
    fenBefore: fen,
    move,
    history: [],
    byUser: true,
    before: pack(fen, [before]),
    after: pack(move.after, [after]),
    verbosity: 'low',
    conceptSeen: {},
  })
}

function flatProfile(): StyleProfile {
  const ids = ['develop', 'castle', 'center', 'capture', 'check'] as const
  const metrics: StyleMetric[] = ids.map((id) => ({ id, label: id, value: 0, samples: 40, explain: id }))
  return { weight: 1, metrics }
}

describe('score sign for the side to move', () => {
  it('turns a side-to-move engine score into White perspective, including mate', () => {
    const black = new Chess()
    black.move('e4')
    const fen = black.fen()
    expect(fen.split(' ')[1]).toBe('b')
    expect(lineToScore({ multipv: 1, depth: 8, cp: 80, mate: null, pv: ['e7e5'] }, fen)).toEqual({ cp: -80, mate: null })
    const mate = lineToScore({ multipv: 1, depth: 8, cp: null, mate: 1, pv: ['e7e5'] }, fen)
    expect(mate.mate).toBe(-1)
    expect(cpFor(mate, 'b')).toBeGreaterThan(0)
    expect(cpFor(lineToScore({ multipv: 1, depth: 8, cp: 80, mate: null, pv: ['e7e5'] }, fen), 'b')).toBe(80)
  })

  it('gives the same centipawn loss and category when Black makes the mirrored mistake', () => {
    const white = assessMove({
      before: { cp: 120, mate: null },
      after: { cp: -180, mate: null },
      color: 'w',
      playedUci: 'a2a3',
      bestUci: 'e2e4',
    })
    const black = assessMove({
      before: { cp: -120, mate: null },
      after: { cp: 180, mate: null },
      color: 'b',
      playedUci: 'a7a5',
      bestUci: 'e7e5',
    })
    expect(black.cpLoss).toBe(white.cpLoss)
    expect(black.cpLoss).toBe(300)
    expect(black.quality).toBe(white.quality)
    expect(black.quality).toBe('blunder')

    const whiteFen = START
    const blackFen = new Chess()
    blackFen.move('e4')
    const quietWhite = comment(whiteFen, 'a3', 10, 'e2e4', -8)
    const quietBlack = comment(blackFen.fen(), 'a5', 10, 'e7e5', -8)
    const loudWhite = comment(whiteFen, 'a3', 30, 'e2e4', 350)
    const loudBlack = comment(blackFen.fen(), 'a5', 30, 'e7e5', 350)
    expect(quietBlack.quality).toBe(quietWhite.quality)
    expect(loudBlack.quality).toBe(loudWhite.quality)
    expect(loudBlack.quality).toBe('blunder')
    expect(loudBlack.headline).toBe('Hrubá chyba!')
    expect(loudBlack.color).toBe('b')
  })

  it('keeps the review graph in White perspective, with a positive score above the centre', () => {
    expect(reviewEvalY(200)).toBeLessThan(80)
    expect(reviewEvalY(-200)).toBeGreaterThan(80)
    expect(reviewEvalY(200) + reviewEvalY(-200)).toBe(160)
  })

  it('spends the coach budget from the side to move and recommends a legal black move', () => {
    const whiteOpen = new Chess()
    whiteOpen.move('e4')
    whiteOpen.move('e5')
    const fen = mirrorFen(whiteOpen.fen())
    expect(new Chess(fen).turn()).toBe('b')
    const lines = [
      { uci: 'd8h4', cp: 40, mate: null },
      { uci: 'g8f6', cp: 25, mate: null },
      { uci: 'a7a5', cp: -90, mate: null },
    ]
    expect(lossBudget(1000)).toBe(80)
    const calm = teachingMove({ fen, lines, elo: 1000, weakness: null })
    expect(calm?.uci).toBe('g8f6')
    const sharp = teachingMove({ fen, lines, elo: 1900, weakness: null })
    expect(sharp?.uci).toBe('d8h4')
    const dropped = teachingMove({
      fen,
      lines: [
        { uci: 'd8h4', cp: 40, mate: null },
        { uci: 'g8f6', cp: -80, mate: null },
      ],
      elo: 1000,
      weakness: null,
    })
    expect(dropped?.uci).toBe('d8h4')
    for (const uci of [calm?.uci, sharp?.uci, dropped?.uci]) {
      expect(playUci(fen, uci ?? '').color).toBe<Color>('b')
    }
  })

  it('ranks calculator suggestions from Black and keeps the blunder worse than the sensible move', async () => {
    const fen = mirrorFen(START)
    const root = [
      { uci: 'e7e5', cp: 40 },
      { uci: 'g8f6', cp: 28 },
      { uci: 'b8c6', cp: 25 },
      { uci: 'd7d6', cp: 10 },
      { uci: 'a7a5', cp: -70 },
      { uci: 'g8h6', cp: -160 },
      { uci: 'b8a6', cp: -200 },
      { uci: 'f7f6', cp: -280 },
    ]
    const result = await calculate(fen, [], scripted(fen, root))
    expect(result?.side).toBe('b')
    expect(result?.turnText).toBe('Na tahu je černý')
    expect(result?.note).toContain('černého')
    const [good, average, bad] = result!.options
    expect(['e7e5', 'g8f6', 'b8c6', 'd7d6']).toContain(good.uci)
    expect(['a7a5', 'g8h6', 'b8a6', 'f7f6']).toContain(bad.uci)
    expect(good.loss ?? 999).toBeLessThan(40)
    expect(bad.loss ?? 0).toBeGreaterThan(100)
    if (average.loss != null && good.loss != null && bad.loss != null) {
      expect(good.loss).toBeLessThan(average.loss)
      expect(average.loss).toBeLessThan(bad.loss)
    }
    expect(branchText(good)).toMatch(/^Bílý: /)
    expect(new Chess(fen).get(good.from)?.color).toBe('b')
  })

  it('says who is better from the side that is asking', () => {
    const whiteBetter = { cp: 200, mate: null }
    const blackBetter = { cp: -200, mate: null }
    expect(describeScore(whiteBetter)).toBe('Máš jasnou výhodu.')
    expect(describeScore(whiteBetter, 'w')).toBe('Máš jasnou výhodu.')
    expect(describeScore(whiteBetter, 'b')).toBe('Soupeř má jasnou výhodu.')
    expect(describeScore(blackBetter, 'b')).toBe('Máš jasnou výhodu.')
    expect(describeScore(blackBetter, 'w')).toBe('Soupeř má jasnou výhodu.')
    expect(describeScore(whiteBetter, 'both')).toBe('Bílý má jasnou výhodu.')
    expect(describeScore(blackBetter, 'both')).toBe('Černý má jasnou výhodu.')
    expect(describeScore({ cp: 0, mate: null }, 'b')).toBe('Pozice je vyrovnaná.')
    expect(describeScore({ cp: -9999, mate: -1 }, 'b')).toBe('Máš vynucený mat hned příštím tahem!')
    expect(describeScore({ cp: 9999, mate: 1 }, 'b')).toBe('Soupeř má vynucený mat hned příštím tahem.')
    expect(describeScore({ cp: -10000, mate: 0 }, 'b')).toBe('Mat – vyhrál jsi!')
    expect(describeScore({ cp: 10000, mate: 0 }, 'w')).toBe('Mat – vyhrál jsi!')
    expect(describeScore({ cp: 10000, mate: 0 }, 'b')).toBe('Mat – soupeř vyhrál.')
    expect(describeScore({ cp: -10000, mate: 0 }, 'both')).toBe('Mat – vyhrál černý.')
  })
})

describe('mirrored colours', () => {
  it('keeps every side-to-move output symmetric', async () => {
    const whiteFen = START
    const blackFen = mirrorFen(whiteFen)
    expect(new Chess(blackFen).fen().split(' ')[1]).toBe('b')

    const whiteScore = lineToScore({ multipv: 1, depth: 4, cp: 40, mate: null, pv: ['e2e4'] }, whiteFen)
    const blackScore = lineToScore({ multipv: 1, depth: 4, cp: 40, mate: null, pv: ['e7e5'] }, blackFen)
    expect(cpFor(whiteScore, 'w')).toBe(cpFor(blackScore, 'b'))
    expect(blackScore.cp).toBe(-whiteScore.cp)

    const whiteLines = [
      { uci: 'd1h5', cp: 40, mate: null },
      { uci: 'g1f3', cp: 25, mate: null },
    ]
    const blackLines = whiteLines.map((line) => ({ ...line, uci: mirrorUci(line.uci) }))
    expect(teachingMove({ fen: blackFen, lines: blackLines, elo: 1000, weakness: null })?.uci).toBe(
      mirrorUci(teachingMove({ fen: whiteFen, lines: whiteLines, elo: 1000, weakness: null })?.uci ?? ''),
    )

    const root = [
      { uci: 'e2e4', cp: 40 },
      { uci: 'g1f3', cp: 28 },
      { uci: 'b1c3', cp: 22 },
      { uci: 'd2d4', cp: 18 },
      { uci: 'a2a4', cp: -70 },
      { uci: 'g1h3', cp: -160 },
      { uci: 'b1a3', cp: -200 },
      { uci: 'f2f3', cp: -280 },
    ]
    const whiteCalc = await calculate(whiteFen, [], scripted(whiteFen, root))
    const blackCalc = await calculate(
      blackFen,
      [],
      scripted(blackFen, root.map((line) => ({ uci: mirrorUci(line.uci), cp: line.cp }))),
    )
    expect(blackCalc?.options.map((option) => option.uci)).toEqual(whiteCalc?.options.map((option) => mirrorUci(option.uci)))
    expect(blackCalc?.options.map((option) => option.loss)).toEqual(whiteCalc?.options.map((option) => option.loss))
    expect(blackCalc?.options.map((option) => option.letter)).toEqual(['A', 'B', 'C'])

    const personal = (fen: string, lines: Array<{ uci: string; cp: number }>) =>
      createPersonalProvider().choose({
        fen,
        mode: 'today',
        strength: 'match',
        now: Date.parse('2026-06-01T00:00:00Z'),
        profile: flatProfile(),
        snapshots: [],
        history: [],
        lines: lines.map((line) => ({ uci: line.uci, cp: line.cp, mate: null })),
        rng: mulberry32(3),
      })
    const whitePersonal = personal(whiteFen, [
      { uci: 'e2e4', cp: 80 },
      { uci: 'a2a4', cp: -200 },
    ])
    const blackPersonal = personal(blackFen, [
      { uci: 'e7e5', cp: 80 },
      { uci: 'a7a5', cp: -200 },
    ])
    expect(blackPersonal.played?.uci).toBe(mirrorUci(whitePersonal.played?.uci ?? ''))
    expect(blackPersonal.candidates.find((candidate) => candidate.uci === 'e7e5')?.probability).toBeGreaterThan(
      blackPersonal.candidates.find((candidate) => candidate.uci === 'a7a5')?.probability ?? 1,
    )
    const hinted = playUci(blackFen, 'e7e5')
    expect(hinted.color).toBe('b')
    expect(hinted.from).toBe('e7')
    expect(linesFrom({ fen: blackFen, bestMove: 'e7e5', lines: [{ multipv: 1, depth: 2, cp: 80, mate: null, pv: ['e7e5'] }], depth: 2, requestedDepth: 2, multipv: 1 })[0]?.cp).toBe(80)
  })
})
