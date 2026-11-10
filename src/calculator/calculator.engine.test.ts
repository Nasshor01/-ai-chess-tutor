import { Chess, type Move } from 'chess.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseUci } from '../chess/utils'
import { NodeEngine } from '../test/nodeEngine'
import { branchText, calculate, type Analyze } from './calculator'

let engine: NodeEngine
let real: Analyze

beforeAll(async () => {
  engine = new NodeEngine()
  await engine.ready()
  real = (fen, options) => engine.analyze(fen, options.depth, options.multipv ?? 1)
}, 30_000)

afterAll(() => engine.quit())

function play(sans: string[]): { fen: string; moves: Move[] } {
  const chess = new Chess()
  const moves = sans.map((san) => chess.move(san))
  return { fen: chess.fen(), moves }
}

describe('calculate (Stockfish)', () => {
  it('gives three legal moves of descending quality with continuations', async () => {
    const { fen, moves } = play(['e4', 'e5'])
    const result = await calculate(fen, moves, real)
    expect(result!.options).toHaveLength(3)
    expect(new Set(result!.options.map((option) => option.uci)).size).toBe(3)
    for (const option of result!.options) {
      expect(new Chess(fen).move(parseUci(option.uci))).toBeTruthy()
      expect(option.preview.length).toBeGreaterThanOrEqual(2)
      expect(branchText(option)).toMatch(/^(Černý|Bílý): /)
    }
    const [good, , bad] = result!.options
    expect(result!.finish).toBeNull()
    expect(good.loss ?? 0).toBeLessThanOrEqual(100)
    if (bad.loss !== null && good.loss !== null) expect(bad.loss).toBeGreaterThan(good.loss)
  }, 60_000)

  it('offers the Légal mate as the sensible move and a mistake beside it', async () => {
    const { fen, moves } = play(['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5', 'Bxd1'])
    const result = await calculate(fen, moves, real)
    expect(result!.options[0].san).toBe('Sxf7+')
    expect(result!.options.map((option) => option.san)).not.toEqual(['Sxf7+', 'Sxf7+', 'Sxf7+'])
    expect(result!.options.some((option) => option.san !== 'Sxf7+')).toBe(true)
    if (result!.finish) expect(result!.options[0].label).toBe('Matová cesta')
  }, 60_000)

  it('switches a rook ending into Dokonči partii and shows the mating path', async () => {
    const fen = '7k/8/5K2/8/8/8/8/R7 w - - 0 1'
    const result = await calculate(fen, [], real)
    expect(result!.finish?.title).toBe('Dokonči partii')
    expect(result!.finish?.mateIn).toBeGreaterThan(0)
    expect(result!.options[0].label).toBe('Matová cesta')
    expect(result!.options[0].previewSan.at(-1)).toMatch(/#/)
    expect(result!.options.some((option) => option.kind === 'practical' || option.kind === 'slow')).toBe(true)
  }, 60_000)
})