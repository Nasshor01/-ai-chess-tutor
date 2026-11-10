// @vitest-environment jsdom
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase } from '../storage/db'
import { writeKv } from '../storage/kv'
import { TRIED_OPENINGS_KEY, hydrateTriedOpenings, loadTriedOpenings, markTriedOpening } from './tried'

beforeEach(() => {
  closeDatabase()
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBKeyRange = IDBKeyRange
  localStorage.clear()
})

afterEach(() => closeDatabase())

describe('tried openings', () => {
  it('remembers an opening in localStorage and prefers the kv copy', async () => {
    expect(loadTriedOpenings()).toEqual([])
    expect(markTriedOpening('italian')).toEqual(['italian'])
    expect(markTriedOpening('italian')).toEqual(['italian'])
    expect(loadTriedOpenings()).toEqual(['italian'])

    await writeKv(TRIED_OPENINGS_KEY, ['C50:Italian Game'])
    expect(await hydrateTriedOpenings()).toEqual(['C50:Italian Game'])
  })
})
