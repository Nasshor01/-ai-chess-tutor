import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, idbGet, idbPut } from './db'
import {
  CALCULATOR_KEY,
  CONCEPTS_KEY,
  MIGRATION_KEY,
  SETTINGS_KEY,
  SOLVED_KEY,
  migrateFromLocalStorage,
  type LocalBackup,
} from './migrate'
import type { KvRecord, MigrationRecord } from './types'

function backup(initial: Record<string, string> = {}): LocalBackup & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
  }
}

const settings = JSON.stringify({ difficulty: 'beginner', mode: 'free', openingId: null, puzzleId: null })

beforeEach(() => {
  closeDatabase()
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBKeyRange = IDBKeyRange
})

afterEach(() => {
  closeDatabase()
})

describe('localStorage migration', () => {
  it('verifies an empty backup and does not invent settings', async () => {
    const source = backup()
    const record = await migrateFromLocalStorage(source)
    expect(record.status).toBe('verified')
    expect(record.snapshot.settings).toBeNull()
    expect(await idbGet('kv', SETTINGS_KEY)).toBeUndefined()
    expect(source.data).toEqual({})
  })

  it('copies the four keys and leaves localStorage in place', async () => {
    const source = backup({
      [SETTINGS_KEY]: settings,
      [CONCEPTS_KEY]: JSON.stringify({ fork: 2 }),
      [SOLVED_KEY]: JSON.stringify(['kr-2']),
      [CALCULATOR_KEY]: '1',
    })
    const before = { ...source.data }
    await migrateFromLocalStorage(source)
    expect(await idbGet<KvRecord>('kv', SETTINGS_KEY)).toMatchObject({ value: { difficulty: 'beginner', mode: 'free' } })
    expect(await idbGet<KvRecord>('kv', CONCEPTS_KEY)).toMatchObject({ value: { fork: 2 } })
    expect(await idbGet<KvRecord>('kv', SOLVED_KEY)).toMatchObject({ value: ['kr-2'] })
    expect(await idbGet<KvRecord>('kv', CALCULATOR_KEY)).toMatchObject({ value: true })
    expect(source.data).toEqual(before)
  })

  it('skips a broken key and still migrates the others', async () => {
    const source = backup({
      [SETTINGS_KEY]: '{',
      [CONCEPTS_KEY]: JSON.stringify({ pin: 1 }),
    })
    const record = await migrateFromLocalStorage(source)
    expect(record.skipped).toEqual([SETTINGS_KEY])
    expect(await idbGet('kv', SETTINGS_KEY)).toBeUndefined()
    expect(await idbGet<KvRecord>('kv', CONCEPTS_KEY)).toMatchObject({ value: { pin: 1 } })
    expect(source.data[SETTINGS_KEY]).toBe('{')
  })

  it('finishes a migration that was interrupted after a matching write', async () => {
    const source = backup({ [SETTINGS_KEY]: settings })
    const snapshot = { settings, concepts: null, solvedPuzzles: null, calculator: null }
    await idbPut('kv', { key: SETTINGS_KEY, value: JSON.parse(settings) })
    await idbPut('kv', { key: MIGRATION_KEY, value: { status: 'written', snapshot, skipped: [] } satisfies MigrationRecord })
    const record = await migrateFromLocalStorage(source)
    expect(record.status).toBe('verified')
    const rows = await idbGet<KvRecord>('kv', SETTINGS_KEY)
    expect(rows).toMatchObject({ value: { mode: 'free' } })
  })

  it('rewrites from localStorage when the interrupted copy does not match', async () => {
    const source = backup({ [SETTINGS_KEY]: settings })
    const snapshot = { settings, concepts: null, solvedPuzzles: null, calculator: null }
    await idbPut('kv', {
      key: SETTINGS_KEY,
      value: { difficulty: 'advanced', mode: 'mate', openingId: null, puzzleId: 'x' },
    })
    await idbPut('kv', { key: MIGRATION_KEY, value: { status: 'written', snapshot, skipped: [] } satisfies MigrationRecord })
    await migrateFromLocalStorage(source)
    expect(await idbGet<KvRecord>('kv', SETTINGS_KEY)).toMatchObject({ value: { difficulty: 'beginner', mode: 'free' } })
    expect(source.data[SETTINGS_KEY]).toBe(settings)
  })

  it('does nothing the second time, even if the backup changes afterwards', async () => {
    const source = backup({ [CALCULATOR_KEY]: '0' })
    await migrateFromLocalStorage(source)
    source.data[CALCULATOR_KEY] = '1'
    await migrateFromLocalStorage(source)
    expect(await idbGet<KvRecord>('kv', CALCULATOR_KEY)).toMatchObject({ value: false })
  })

  it('does not write when the backup cannot be read', async () => {
    const source: LocalBackup = {
      getItem() {
        throw new Error('blocked')
      },
    }
    await expect(migrateFromLocalStorage(source)).rejects.toMatchObject({ reason: 'unknown' })
    expect(await idbGet('kv', MIGRATION_KEY)).toBeUndefined()
  })
})
