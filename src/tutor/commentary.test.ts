import { Chess, type Move } from 'chess.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NodeEngine } from '../test/nodeEngine'
import { buildComment } from './commentary'
import { buildSummary } from './summary'
import type { TutorComment, Verbosity } from './types'

let engine: NodeEngine

beforeAll(async () => {
  engine = new NodeEngine()
  await engine.ready()
}, 30_000)

afterAll(() => engine.quit())

async function commentFor(sans: string[], verbosity: Verbosity = 'high', startFen?: string): Promise<TutorComment> {
  const chess = new Chess(startFen)
  const history: Move[] = []
  sans.slice(0, -1).forEach((san) => history.push(chess.move(san)))
  const fenBefore = chess.fen()
  const move = chess.move(sans[sans.length - 1])
  const before = await engine.analyze(fenBefore, 12, 3)
  const after = chess.isGameOver() ? null : await engine.analyze(move.after, 12, 1)
  return buildComment({
    plyIndex: history.length,
    fenBefore,
    move,
    history,
    byUser: move.color === 'w',
    before,
    after,
    verbosity,
    conceptSeen: {},
  })
}

function print(label: string, c: TutorComment) {
  const lines = [
    `── ${label}: ${c.moveNumber}. ${c.san} → ${c.headline} [${c.quality}, ztráta ${c.winLoss.toFixed(1)} %]`,
    ...c.reasons.map((r) => `   • ${r}`),
    ...(c.better ? [`   ➜ ${c.better.minor ? 'Ještě lepší' : 'Lepší'} bylo ${c.better.san} – ${c.better.explanation}. (${c.better.line})`] : []),
    ...c.threats.mine.map((t) => `   ⚔ ${t}`),
    ...c.threats.against.map((t) => `   ⚠ ${t}`),
    ...c.concepts.map((m) => `   ◆ ${m.concept.title}${m.showExplanation ? ' (vysvětleno)' : ''}`),
  ]
  console.log(lines.join('\n'))
}

describe('tutor commentary with Stockfish', () => {
  it('praises a strong opening move', async () => {
    const c = await commentFor(['e4'])
    print('Otevírací tah', c)
    expect(c.verdict).toBe('good')
    expect(c.reasons.join(' ')).toContain('kontrola středu')
    expect(c.concepts[0].showExplanation).toBe(true)
  }, 30_000)

  it('explains a hanging piece blunder and the better move', async () => {
    const c = await commentFor(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6', 'Ng5', 'h6', 'Nxf7'])
    print('Obětování jezdce', c)
    const c2 = await commentFor(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Bxf7+'])
    print('Bxf7+', c2)
    const c3 = await commentFor(['e4', 'e5', 'Qh5', 'Nc6', 'Qxf7+'])
    print('Qxf7+?? (dáma visí)', c3)
    expect(c3.verdict).toBe('bad')
    expect(c3.better).not.toBeNull()
    const c4 = await commentFor(['d4', 'e5', 'Nf3', 'e4', 'Nfd2', 'd5', 'e3', 'Bb4', 'c3', 'Bd6', 'Nb3'])
    print('Klidný tah', c4)
  }, 60_000)

  it('flags the early queen and explains the reply threat', async () => {
    const c = await commentFor(['e4', 'e5', 'Qh5'])
    print('Výpad dámou', c)
    expect(c.reasons.join(' ')).toContain('Dáma')
  }, 30_000)

  it('spots a missed mate defence', async () => {
    const c = await commentFor(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'], 'medium')
    print('Černý přehlédl mat (pohled soupeře)', c)
    const c2 = await commentFor(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])
    print('Mat', c2)
    expect(c2.reasons[0]).toContain('Mat')
  }, 30_000)

  it('produces a game summary', async () => {
    const comments = await Promise.all([
      commentFor(['e4']),
      commentFor(['e4', 'e5', 'Nf3']),
      commentFor(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']),
      commentFor(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5']),
    ])
    const summary = buildSummary(comments, 'loss', 'resign')
    console.log(JSON.stringify(summary, null, 2))
    expect(summary.userMoves).toBe(4)
    expect(summary.accuracy).not.toBeNull()
  }, 60_000)
})
