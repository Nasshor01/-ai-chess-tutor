import { Chess, type Move } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { analyzeMove } from './features'

function play(sans: string[]): { fenBefore: string; move: Move; history: Move[] } {
  const chess = new Chess()
  const history: Move[] = []
  sans.slice(0, -1).forEach((san) => history.push(chess.move(san)))
  const fenBefore = chess.fen()
  const move = chess.move(sans[sans.length - 1])
  return { fenBefore, move, history }
}

describe('analyzeMove', () => {
  it('recognises central pawn moves and opened diagonals', () => {
    const { fenBefore, move, history } = play(['e4'])
    const facts = analyzeMove(fenBefore, move, history)
    expect(facts.centerPawn).toBe(true)
    expect(facts.diagonalFor).toBe('b')
  })

  it('recognises development towards the centre', () => {
    const { fenBefore, move, history } = play(['e4', 'e5', 'Nf3'])
    const facts = analyzeMove(fenBefore, move, history)
    expect(facts.development).toBe(true)
    expect(facts.centerControl).toBeGreaterThan(0)
    expect(facts.threats.map((t) => t.square)).toContain('e5')
  })

  it('recognises castling with the rook joining the game', () => {
    const { fenBefore, move, history } = play(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O'])
    const facts = analyzeMove(fenBefore, move, history)
    expect(facts.castle).toBe('king')
  })

  it('flags an early queen sortie', () => {
    const { fenBefore, move, history } = play(['e4', 'e5', 'Qh5'])
    expect(analyzeMove(fenBefore, move, history).earlyQueen).toBe(true)
  })

  it('finds a knight fork', () => {
    const chess = new Chess('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1')
    const fenBefore = chess.fen()
    const move = chess.move('Nc7+')
    const facts = analyzeMove(fenBefore, move, [])
    expect(facts.fork?.map((t) => t.piece).sort()).toEqual(['k', 'r'])
  })

  it('notices a piece left hanging', () => {
    const { fenBefore, move, history } = play(['e4', 'e5', 'Bc4', 'd6', 'Bxf7+'])
    void history
    const facts = analyzeMove(fenBefore, move, [])
    expect(facts.hangingAfter.map((h) => h.square)).toContain('f7')
  })
})
