import { idbDeleteRange, idbGet, idbGetAll, idbGetAllByIndex, requestToPromise, withStores } from './db'
import { enqueue } from './queue'
import type { Game, KvRecord, MoveRecord } from './types'

export const ACTIVE_GAME_KEY = 'ai-chess-tutor:active-game'

export function newGameId(): string {
  return `g_${crypto.randomUUID()}`
}

export function liveDedupKey(id: string): string {
  return `live:${id}`
}

/** Identity of an imported game: moves plus the headers that distinguish a real duplicate. */
export function importDedupKey(parts: {
  startFen: string
  uci: readonly string[]
  white: string
  black: string
  date: string
  result: string
}): string {
  return fingerprint([
    parts.startFen.trim(),
    parts.uci.join(' '),
    norm(parts.white),
    norm(parts.black),
    parts.date.trim(),
    parts.result.trim(),
  ])
}

export function saveGame(game: Game): Promise<void> {
  return enqueue(() => putGame(game))
}

export function saveMove(move: MoveRecord): Promise<void> {
  return enqueue(() => putMove(move))
}

export function trimMoves(gameId: string, fromPly: number): Promise<void> {
  return enqueue(() => idbDeleteRange('moves', IDBKeyRange.bound([gameId, fromPly], [gameId, Number.MAX_SAFE_INTEGER])))
}

export function listGames(): Promise<Game[]> {
  return enqueue(async () => {
    const games = await idbGetAll<Game>('games')
    return games.filter(isGame).sort((a, b) => b.updatedAt - a.updatedAt)
  })
}

export function movesFor(gameId: string): Promise<MoveRecord[]> {
  return enqueue(async () => {
    const moves = await idbGetAllByIndex<MoveRecord>('moves', 'gameId', gameId)
    return moves.filter(isMove).sort((a, b) => a.ply - b.ply)
  })
}

export function gamesWithDedup(dedupKey: string): Promise<Game[]> {
  return enqueue(async () => {
    const games = await idbGetAllByIndex<Game>('games', 'dedupKey', dedupKey)
    return games.filter(isGame)
  })
}

/** Inserts an imported game unless the same moves and key headers are already stored. */
export function insertImported(game: Game, moves: MoveRecord[]): Promise<'inserted' | 'duplicate'> {
  return enqueue(async () => {
    const existing = await idbGetAllByIndex<Game>('games', 'dedupKey', game.dedupKey)
    if (existing.some(isGame)) return 'duplicate'
    await withStores(['games', 'moves'], 'readwrite', async (store) => {
      await requestToPromise(store('games').put(game))
      for (const move of moves) await requestToPromise(store('moves').put(move))
    })
    return 'inserted'
  })
}

export function removeGame(id: string): Promise<void> {
  return enqueue(async () => {
    const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])
    await withStores(['games', 'moves', 'kv'], 'readwrite', async (store) => {
      await requestToPromise(store('games').delete(id))
      await deleteKeys(store('moves').openCursor(range))
      const current = await requestToPromise(store('kv').get(ACTIVE_GAME_KEY))
      const row = current as KvRecord | undefined
      if (row?.value === id) await requestToPromise(store('kv').delete(ACTIVE_GAME_KEY))
    })
  })
}

/** An in-progress game and its moves, or null when it is missing or already finished. */
export function gameBundle(id: string): Promise<{ game: Game; moves: MoveRecord[] } | null> {
  return enqueue(async () => {
    const game = await idbGet<Game>('games', id)
    if (!isGame(game) || game.status !== 'in-progress') return null
    const moves = (await idbGetAllByIndex<MoveRecord>('moves', 'gameId', id)).filter(isMove).sort((a, b) => a.ply - b.ply)
    return { game, moves }
  })
}

/** Writes the whole live game, then drops any ply past the end of `moves`. */
export function commitLiveGame(game: Game, moves: MoveRecord[], stillCurrent: () => boolean): Promise<void> {
  return enqueue(async () => {
    if (!stillCurrent()) return
    await withStores(['games', 'moves', 'kv'], 'readwrite', async (store) => {
      await requestToPromise(store('games').put(game))
      for (const move of moves) await requestToPromise(store('moves').put(move))
      await deleteKeys(store('moves').openCursor(IDBKeyRange.bound([game.id, moves.length], [game.id, Number.MAX_SAFE_INTEGER])))
      if (game.status === 'in-progress') {
        await requestToPromise(store('kv').put({ key: ACTIVE_GAME_KEY, value: game.id }))
      } else {
        const current = await requestToPromise(store('kv').get(ACTIVE_GAME_KEY))
        const row = current as KvRecord | undefined
        if (row?.value === game.id) await requestToPromise(store('kv').delete(ACTIVE_GAME_KEY))
      }
    })
  })
}

export function readActiveGame(): Promise<{ game: Game; moves: MoveRecord[] } | null> {
  return enqueue(async () => {
    const row = await idbGet<KvRecord>('kv', ACTIVE_GAME_KEY)
    if (typeof row?.value !== 'string') return null
    const game = await idbGet<Game>('games', row.value)
    if (!isGame(game) || game.status !== 'in-progress') return null
    const moves = (await idbGetAllByIndex<MoveRecord>('moves', 'gameId', game.id)).filter(isMove).sort((a, b) => a.ply - b.ply)
    return { game, moves }
  })
}

export function whenStorageIdle(): Promise<void> {
  return enqueue(() => Promise.resolve())
}

export function setActiveGameId(id: string | null): Promise<void> {
  return enqueue(() => putActive(id))
}

export function getActiveGameId(): Promise<string | null> {
  return enqueue(async () => {
    const row = await idbGet<KvRecord>('kv', ACTIVE_GAME_KEY)
    return typeof row?.value === 'string' ? row.value : null
  })
}

async function putGame(game: Game): Promise<void> {
  await withStores(['games'], 'readwrite', async (store) => {
    await requestToPromise(store('games').put(game))
  })
}

async function putMove(move: MoveRecord): Promise<void> {
  await withStores(['moves'], 'readwrite', async (store) => {
    await requestToPromise(store('moves').put(move))
  })
}

async function putActive(id: string | null): Promise<void> {
  await withStores(['kv'], 'readwrite', async (store) => {
    if (id === null) await requestToPromise(store('kv').delete(ACTIVE_GAME_KEY))
    else await requestToPromise(store('kv').put({ key: ACTIVE_GAME_KEY, value: id }))
  })
}

function deleteKeys(request: IDBRequest<IDBCursorWithValue | null>): Promise<void> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('cursor'))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      const deletion = cursor.delete()
      deletion.onerror = () => reject(deletion.error ?? new Error('delete'))
      deletion.onsuccess = () => cursor.continue()
    }
  })
}

function norm(name: string): string {
  return name.trim().toLowerCase()
}

function fingerprint(parts: string[]): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  const text = parts.join('\n')
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

function isGame(value: unknown): value is Game {
  if (typeof value !== 'object' || value === null) return false
  const game = value as Game
  return typeof game.id === 'string' && typeof game.updatedAt === 'number' && typeof game.dedupKey === 'string'
}

function isMove(value: unknown): value is MoveRecord {
  if (typeof value !== 'object' || value === null) return false
  const move = value as MoveRecord
  return typeof move.gameId === 'string' && typeof move.ply === 'number' && typeof move.uci === 'string'
}
