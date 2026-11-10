import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase } from './db'
import {
  gamesWithDedup,
  getActiveGameId,
  importDedupKey,
  insertImported,
  allMoves,
  listGames,
  liveDedupKey,
  movesFor,
  newGameId,
  removeGame,
  saveGame,
  saveMove,
  setActiveGameId,
  trimMoves,
} from './games'
import type { Game, MoveRecord } from './types'

function game(patch: Partial<Game> & Pick<Game, 'id' | 'dedupKey' | 'updatedAt'>): Game {
  return {
    pgn: '',
    result: '*',
    userColor: 'w',
    source: 'app-free',
    createdAt: patch.updatedAt,
    status: 'in-progress',
    headers: { Event: 'Volná hra', Site: 'AI Chess Tutor', Date: '2026.01.01', White: 'Hráč', Black: 'Stockfish', Result: '*' },
    startFen: 'start',
    plyCount: 0,
    ...patch,
  }
}

function move(gameId: string, ply: number, uci: string): MoveRecord {
  return { gameId, ply, fenBefore: 'start', uci, san: uci, byUser: ply % 2 === 0 }
}

beforeEach(() => {
  closeDatabase()
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBKeyRange = IDBKeyRange
})

afterEach(() => closeDatabase())

describe('stored games', () => {
  it('lists games by newest update and deletes a game together with its moves', async () => {
    const older = game({ id: 'old', dedupKey: liveDedupKey('old'), updatedAt: 1 })
    const newer = game({ id: 'new', dedupKey: liveDedupKey('new'), updatedAt: 2 })
    await saveGame(older)
    await saveGame(newer)
    await saveMove(move('old', 0, 'e2e4'))
    await saveMove(move('new', 0, 'd2d4'))
    expect((await listGames()).map((item) => item.id)).toEqual(['new', 'old'])
    await removeGame('old')
    expect((await listGames()).map((item) => item.id)).toEqual(['new'])
    expect(await movesFor('old')).toEqual([])
    expect((await movesFor('new')).map((item) => item.uci)).toEqual(['d2d4'])
    expect((await allMoves()).map((item) => item.uci)).toEqual(['d2d4'])
  })

  it('overwrites a ply and drops the moves undone after it', async () => {
    await saveMove(move('g', 0, 'e2e4'))
    await saveMove(move('g', 1, 'e7e5'))
    await saveMove(move('g', 0, 'd2d4'))
    await trimMoves('g', 1)
    expect((await movesFor('g')).map((item) => item.uci)).toEqual(['d2d4'])
  })

  it('treats the same import key as one game and a different date as another', async () => {
    const shared = {
      startFen: 'start',
      uci: ['e2e4', 'e7e5'],
      white: ' Anna ',
      black: 'BoB',
      date: '2026.01.01',
      result: '1-0',
    }
    const key = importDedupKey(shared)
    expect(importDedupKey({ ...shared, white: 'anna', black: 'bob' })).toBe(key)
    expect(importDedupKey({ ...shared, date: '2026.02.02' })).not.toBe(key)
    const first = game({ id: newGameId(), dedupKey: key, updatedAt: 1, source: 'import' })
    const again = game({ id: newGameId(), dedupKey: key, updatedAt: 2, source: 'import' })
    const other = game({
      id: newGameId(),
      dedupKey: importDedupKey({ ...shared, date: '2026.02.02' }),
      updatedAt: 3,
      source: 'import',
    })
    expect(await insertImported(first, [move(first.id, 0, 'e2e4')])).toBe('inserted')
    expect(await insertImported(again, [move(again.id, 0, 'e2e4')])).toBe('duplicate')
    expect(await insertImported(other, [move(other.id, 0, 'e2e4')])).toBe('inserted')
    expect(await gamesWithDedup(key)).toHaveLength(1)
    expect(await listGames()).toHaveLength(2)
  })

  it('remembers which game is in progress', async () => {
    expect(await getActiveGameId()).toBeNull()
    await setActiveGameId('g1')
    expect(await getActiveGameId()).toBe('g1')
    await saveGame(game({ id: 'g1', dedupKey: liveDedupKey('g1'), updatedAt: 1 }))
    await removeGame('g1')
    expect(await getActiveGameId()).toBeNull()
    await setActiveGameId('g2')
    await saveGame(game({ id: 'other', dedupKey: liveDedupKey('other'), updatedAt: 2 }))
    await removeGame('other')
    expect(await getActiveGameId()).toBe('g2')
  })
})
