import { Chess, DEFAULT_POSITION } from 'chess.js'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { estimateElo } from '../elo/estimate'
import { styleProfile } from '../profile/styleProfile'
import { closeDatabase } from './db'
import { listGames, movesFor } from './games'
import { exportPgn, importPgnText, splitPgnGames } from './pgn'

const backRank = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'

beforeEach(() => {
  closeDatabase()
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBKeyRange = IDBKeyRange
})

afterEach(() => closeDatabase())

describe('PGN', () => {
  it('round-trips moves, the result and a custom start position', async () => {
    const standard = exportPgn({
      startFen: DEFAULT_POSITION,
      uci: ['e2e4', 'e7e5'],
      event: 'Volná hra',
      site: 'AI Chess Tutor',
      date: '2026.11.10',
      white: 'Hráč',
      black: 'Stockfish',
      result: '*',
    })
    expect(standard).not.toMatch(/\[SetUp/)
    const imported = await importPgnText(standard, { color: 'w', name: 'Hráč' })
    expect(imported.imported).toBe(1)
    const [game] = await listGames()
    expect(game?.result).toBe('*')
    expect(game?.startFen).toBe(DEFAULT_POSITION)
    expect(game?.userColor).toBe('w')
    expect((await movesFor(game?.id ?? '')).map((move) => move.uci)).toEqual(['e2e4', 'e7e5'])

    const custom = exportPgn({
      startFen: backRank,
      uci: ['d1d8'],
      event: 'Kalkulačka',
      site: 'AI Chess Tutor',
      date: '2026.11.10',
      white: 'Hráč',
      black: 'Hráč',
      result: '1-0',
    })
    expect(custom).toMatch(/\[SetUp "1"\]/)
    expect(custom).toContain(backRank)
    const second = await importPgnText(custom, { color: 'both' })
    expect(second.imported).toBe(1)
    const stored = (await listGames()).find((item) => item.result === '1-0')
    expect(stored?.startFen).toBe(backRank)
    expect((await movesFor(stored?.id ?? '')).map((move) => move.uci)).toEqual(['d1d8'])
  })

  it('imports the good game from a file and skips the illegal one', async () => {
    const file = `[Event "A"]\n\n1. e4 e5 *\n\n[Event "B"]\n\n1. e4 e5 2. Qh5 Ke7 not-a-move\n`
    expect(splitPgnGames(file)).toHaveLength(2)
    const report = await importPgnText(file, { color: 'b', name: 'nikdo' })
    expect(report.imported).toBe(1)
    expect(report.skipped).toEqual([{ index: 2, reason: 'Nelegální tah' }])
    expect(report.duplicates).toBe(0)
    const [game] = await listGames()
    expect(game?.userColor).toBe('b')
  })

  it('keeps the main line when a variation is present and counts a duplicate', async () => {
    const file = `[Event "Var"]\n[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 {dobře} e5 (1... c5) 2. Nf3 *\n`
    const report = await importPgnText(file, { color: 'w' })
    expect(report.variationsDropped).toBe(true)
    expect(report.imported).toBe(1)
    const [game] = await listGames()
    expect((await movesFor(game?.id ?? '')).map((move) => move.san)).toEqual(['e4', 'e5', 'Nf3'])
    const again = await importPgnText(file, { color: 'w' })
    expect(again.duplicates).toBe(1)
    expect(await listGames()).toHaveLength(1)
  })

  it('rejects a file that is not UTF-8 and yields between batches', async () => {
    const broken = await importPgnText('1. e4 \uFFFD', { color: 'w' })
    expect(broken.error).toMatch(/UTF-8/)
    expect(await listGames()).toHaveLength(0)

    const many = ['[Event "0"]\n\n1. e4 c5 *', '[Event "1"]\n\n1. d4 d5 *', '[Event "2"]\n\n1. c4 e5 *'].join('\n\n')
    let yields = 0
    const report = await importPgnText(many, { color: 'w' }, {
      yieldEvery: 2,
      yieldNow: () => {
        yields += 1
        return Promise.resolve()
      },
    })
    expect(report.imported).toBe(3)
    expect(yields).toBe(1)
  })

  it('exports a move chess.js can play back', () => {
    const pgn = exportPgn({
      startFen: DEFAULT_POSITION,
      uci: ['e2e4', 'e7e5', 'g1f3'],
      event: 'Volná hra',
      site: 'AI Chess Tutor',
      date: '2026.11.10',
      white: 'Hráč',
      black: 'Stockfish',
      result: '*',
    })
    const chess = new Chess()
    chess.loadPgn(pgn)
    expect(chess.history()).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('attributes a game to Nasshor01 only when that name is Black', async () => {
    const pgn = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.11.10"]
[White "Hans"]
[Black "Nasshor01"]
[Result "1-0"]

1. Nf3 a5 2. Nc3 a4 1-0
`
    const report = await importPgnText(pgn, { color: 'w', name: 'Nasshor01' })
    expect(report.imported).toBe(1)
    const [game] = await listGames()
    expect(game?.userColor).toBe('b')
    const rows = await movesFor(game?.id ?? '')
    expect(rows.map((move) => move.san)).toEqual(['Nf3', 'a5', 'Nc3', 'a4'])
    expect(rows.map((move) => move.byUser)).toEqual([false, true, false, true])

    const analysed = rows.map((move) => ({
      byUser: move.byUser,
      cpLoss: move.byUser ? 10 : 400,
      category: move.byUser ? 'good' : 'blunder',
      phase: 'opening' as const,
      evalBefore: 80,
    }))
    const estimate = estimateElo(
      [{ id: 'hans', result: '1-0', userColor: 'b', source: 'import', updatedAt: 1, moves: Array.from({ length: 4 }, () => analysed).flat() }],
      { anchor: 1500 },
    )
    expect(estimate.acpl).toBe(10)
    expect(estimate.games).toBe(1)

    const style = styleProfile(
      [{ updatedAt: 1, moves: Array.from({ length: 12 }, () => rows).flat() }],
      1,
    )
    const develop = style.metrics.find((metric) => metric.id === 'develop')
    expect(develop?.samples).toBe(24)
    expect(develop?.value).toBe(0)
  })
})
