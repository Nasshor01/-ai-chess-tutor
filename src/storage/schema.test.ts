import { describe, expect, it } from 'vitest'
import { DB_NAME, DB_VERSION, SCHEMA, STORE_NAMES } from './schema'

describe('IndexedDB schema', () => {
  it('is version 1 and names the database', () => {
    expect(DB_NAME).toBe('ai-chess-tutor')
    expect(DB_VERSION).toBe(1)
  })

  it('creates the game stores and the empty stores for later phases', () => {
    expect(SCHEMA.map((store) => store.name)).toEqual([...STORE_NAMES])
  })

  it('keys moves by game and ply and does not make the import key unique', () => {
    const moves = SCHEMA.find((store) => store.name === 'moves')
    const games = SCHEMA.find((store) => store.name === 'games')
    expect(moves?.keyPath).toEqual(['gameId', 'ply'])
    expect(moves?.indexes.map((index) => index.name)).toEqual(['gameId'])
    const dedup = games?.indexes.find((index) => index.name === 'dedupKey')
    expect(dedup?.unique).toBe(false)
    expect(games?.indexes.map((index) => index.name)).toEqual(['updatedAt', 'status', 'source', 'dedupKey', 'createdAt'])
  })
})
