import { Chess, type Move } from 'chess.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NodeEngine } from '../test/nodeEngine'
import type { PlyRecord } from '../game/types'
import { branchText, calculate, detectStyle, type Analyze } from './calculator'

let engine: NodeEngine
let analyze: Analyze

beforeAll(async () => {
  engine = new NodeEngine()
  await engine.ready()
  analyze = (fen, o) => engine.analyze(fen, o.depth, o.multipv ?? 1)
}, 30_000)

afterAll(() => engine.quit())

function play(sans: string[]): { chess: Chess; plies: PlyRecord[]; moves: Move[] } {
  const chess = new Chess()
  const moves = sans.map((san) => chess.move(san))
  return { chess, moves, plies: moves.map((move, index) => ({ index, move, byUser: move.color === 'w' })) }
}

describe('detectStyle', () => {
  it('is neutral with too few moves', () => {
    expect(detectStyle(play(['e4', 'e5']).plies, {}).style).toBe('neutral')
  })

  it('recognises an aggressive player', () => {
    const { plies } = play(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'g6', 'Qf3', 'Nf6', 'Qb3', 'Qe7', 'Bxf7+', 'Kd8'])
    expect(detectStyle(plies, {}).style).toBe('aggressive')
  })

  it('recognises a solid player', () => {
    const { plies } = play(['d4', 'd5', 'Nf3', 'Nf6', 'e3', 'e6', 'Be2', 'Be7', 'O-O', 'O-O'])
    expect(detectStyle(plies, {}).style).toBe('solid')
  })
})

describe('calculate', () => {
  it('offers distinct practical options with branches', async () => {
    const { chess, moves } = play(['e4', 'e5', 'Nf3', 'Nc6'])
    const result = await calculate(chess.fen(), moves, detectStyle([], {}), analyze)
    expect(result).not.toBeNull()
    const options = result!.options
    expect(options.length).toBeGreaterThanOrEqual(2)
    expect(new Set(options.map((o) => o.uci)).size).toBe(options.length)
    expect(options.filter((o) => o.recommended)).toHaveLength(1)
    for (const option of options) {
      expect(option.label).toMatch(/^Tah [ABC] – /)
      expect(option.preview.length).toBeGreaterThanOrEqual(2)
      expect(branchText(option)).toMatch(/^Soupeř: /)
      console.log(option.label, option.san, option.scoreText, '|', option.explanation, '|', branchText(option), '|', option.previewSan.join(' '))
    }
  }, 60_000)

  it('only suggests mating moves when a forced mate exists', async () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
    const result = await calculate(fen, [], detectStyle([], {}), analyze)
    expect(result!.options[0].san).toBe('Vd8#')
    expect(result!.note).toContain('mat')
  }, 60_000)

  it('finds the Légal mate after the queen is taken', async () => {
    const { chess, moves } = play(['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1'])
    const result = await calculate(chess.fen(), moves, detectStyle([], {}), analyze)
    expect(result!.options[0].san).toBe('Sxf7+')
    expect(result!.options[0].previewSan.slice(0, 3)).toEqual(['Sxf7+', 'Ke7', 'Jd5#'])
  }, 60_000)

  it('recommends the tactical option to an aggressive player', async () => {
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5'
    const aggressive = detectStyle(play(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'g6', 'Qf3', 'Nf6']).plies, {})
    const result = await calculate(fen, [], aggressive, analyze)
    const tactical = result!.options.find((o) => o.kind === 'tactical')
    expect(tactical).toBeDefined()
    expect(tactical!.recommended).toBe(true)
    console.log(result!.options.map((o) => `${o.letter} ${o.san} ${o.scoreText} | ${o.explanation} | ${branchText(o)}`).join('\n'))
  }, 60_000)
})
