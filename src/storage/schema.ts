import { DB_VERSION } from './types'

export { DB_NAME, DB_VERSION } from './types'

export const STORE_NAMES = [
  'kv',
  'games',
  'moves',
  'analysisCache',
  'profileSnapshots',
  'eloSnapshots',
  'trainingItems',
] as const

export type StoreName = (typeof STORE_NAMES)[number]

export interface IndexSpec {
  name: string
  keyPath: string
  unique: boolean
}

export interface StoreSpec {
  name: StoreName
  keyPath: string | string[]
  indexes: IndexSpec[]
}

/**
 * Version 1 creates every store, including the ones later phases only fill.
 * `moves` uses a compound key so a ply is overwritten instead of duplicated.
 * `dedupKey` is indexed and not unique.
 */
export const SCHEMA: readonly StoreSpec[] = [
  { name: 'kv', keyPath: 'key', indexes: [] },
  {
    name: 'games',
    keyPath: 'id',
    indexes: [
      { name: 'updatedAt', keyPath: 'updatedAt', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'source', keyPath: 'source', unique: false },
      { name: 'dedupKey', keyPath: 'dedupKey', unique: false },
      { name: 'createdAt', keyPath: 'createdAt', unique: false },
    ],
  },
  {
    name: 'moves',
    keyPath: ['gameId', 'ply'],
    indexes: [{ name: 'gameId', keyPath: 'gameId', unique: false }],
  },
  { name: 'analysisCache', keyPath: 'key', indexes: [] },
  {
    name: 'profileSnapshots',
    keyPath: 'id',
    indexes: [{ name: 'createdAt', keyPath: 'createdAt', unique: false }],
  },
  {
    name: 'eloSnapshots',
    keyPath: 'id',
    indexes: [{ name: 'createdAt', keyPath: 'createdAt', unique: false }],
  },
  {
    name: 'trainingItems',
    keyPath: 'id',
    indexes: [{ name: 'createdAt', keyPath: 'createdAt', unique: false }],
  },
]

export function applySchema(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion >= DB_VERSION) return
  for (const spec of SCHEMA) {
    if (db.objectStoreNames.contains(spec.name)) continue
    const store = db.createObjectStore(spec.name, { keyPath: spec.keyPath })
    for (const index of spec.indexes) {
      store.createIndex(index.name, index.keyPath, { unique: index.unique })
    }
  }
}
