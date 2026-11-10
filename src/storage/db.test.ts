import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, idbDelete, idbDeleteRange, idbGet, idbGetAll, idbGetAllByIndex, idbPut, openDatabase } from './db'
import { clearStorageWarning, mapStorageError, reportStorageFailure, storageWarning, subscribeStorageWarning } from './errors'
import { STORE_NAMES } from './schema'

beforeEach(() => {
  closeDatabase()
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBKeyRange = IDBKeyRange
  clearStorageWarning()
})

afterEach(() => {
  closeDatabase()
})

describe('IndexedDB wrapper', () => {
  it('creates every store from the schema', async () => {
    const db = await openDatabase()
    expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort())
  })

  it('round-trips a record and deletes by a compound key range', async () => {
    await idbPut('moves', { gameId: 'g', ply: 0, san: 'e4' })
    await idbPut('moves', { gameId: 'g', ply: 1, san: 'e5' })
    await idbPut('moves', { gameId: 'g', ply: 2, san: 'Nf3' })
    await idbDeleteRange('moves', IDBKeyRange.bound(['g', 1], ['g', Number.MAX_SAFE_INTEGER]))
    const left = await idbGetAll<{ san: string }>('moves')
    expect(left.map((row) => row.san)).toEqual(['e4'])
    expect(await idbGet<{ san: string }>('moves', ['g', 0])).toEqual({ gameId: 'g', ply: 0, san: 'e4' })
  })

  it('reads an index without treating it as unique', async () => {
    await idbPut('games', { id: 'a', dedupKey: 'same', updatedAt: 1 })
    await idbPut('games', { id: 'b', dedupKey: 'same', updatedAt: 2 })
    const found = await idbGetAllByIndex<{ id: string }>('games', 'dedupKey', 'same')
    expect(found.map((row) => row.id).sort()).toEqual(['a', 'b'])
    await idbDelete('games', 'a')
    expect(await idbGet('games', 'a')).toBeUndefined()
  })

  it('reports a missing database as private mode', async () => {
    closeDatabase()
    const scope = globalThis as { indexedDB?: IDBFactory }
    const real = scope.indexedDB
    scope.indexedDB = undefined
    await expect(openDatabase()).rejects.toMatchObject({ reason: 'private' })
    scope.indexedDB = real
  })

  it('maps quota, blocked version and abort errors', () => {
    expect(mapStorageError(new DOMException('full', 'QuotaExceededError')).reason).toBe('quota')
    expect(mapStorageError(new DOMException('version', 'VersionError')).reason).toBe('blocked')
    expect(mapStorageError(new DOMException('abort', 'AbortError')).reason).toBe('aborted')
    expect(mapStorageError(new DOMException('security', 'SecurityError')).reason).toBe('private')
    expect(storageWarning('quota')).toMatch(/plné/)
  })

  it('publishes a visible warning and can clear it', () => {
    const seen: Array<string | null> = []
    const stop = subscribeStorageWarning((warning) => seen.push(warning))
    reportStorageFailure(new DOMException('full', 'QuotaExceededError'))
    expect(seen.at(-1)).toMatch(/plné/)
    clearStorageWarning()
    expect(seen.at(-1)).toBeNull()
    stop()
  })
})
