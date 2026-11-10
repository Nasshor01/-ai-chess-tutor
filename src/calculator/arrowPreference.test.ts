// @vitest-environment jsdom
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase } from '../storage/db'
import { writeKv } from '../storage/kv'
import { SHOW_ALL_ARROWS_KEY, hydrateShowAllArrows, loadShowAllArrows } from './arrowPreference'

beforeEach(() => {
  closeDatabase()
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBKeyRange = IDBKeyRange
  localStorage.clear()
})

afterEach(() => {
  closeDatabase()
})

describe('show all calculator arrows', () => {
  it('stays off until the player turns it on', () => {
    expect(loadShowAllArrows()).toBe(false)
    localStorage.setItem(SHOW_ALL_ARROWS_KEY, '1')
    expect(loadShowAllArrows()).toBe(true)
  })

  it('prefers the saved kv value and falls back to localStorage when kv is empty', async () => {
    localStorage.setItem(SHOW_ALL_ARROWS_KEY, '0')
    await writeKv(SHOW_ALL_ARROWS_KEY, true)
    expect(await hydrateShowAllArrows()).toBe(true)

    closeDatabase()
    globalThis.indexedDB = new IDBFactory()
    expect(await hydrateShowAllArrows()).toBeNull()
    expect(loadShowAllArrows()).toBe(false)
  })
})
