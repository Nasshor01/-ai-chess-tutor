import { mapStorageError, StorageError } from './errors'
import { applySchema } from './schema'
import { DB_NAME, DB_VERSION } from './types'
import type { StoreName } from './schema'

let database: IDBDatabase | null = null
let opening: Promise<IDBDatabase> | null = null
let blockedRetries = 0

export function closeDatabase(): void {
  database?.close()
  database = null
  opening = null
}

export async function openDatabase(): Promise<IDBDatabase> {
  try {
    return await openOnce()
  } catch (error) {
    const mapped = mapStorageError(error)
    if (mapped.reason !== 'blocked' || blockedRetries > 0) throw mapped
    blockedRetries += 1
    closeDatabase()
    try {
      return await openOnce()
    } catch (again) {
      throw mapStorageError(again)
    } finally {
      blockedRetries = 0
    }
  }
}

function openOnce(): Promise<IDBDatabase> {
  if (database) return Promise.resolve(database)
  if (!opening) {
    opening = connect()
      .then((opened) => {
        database = opened
        opened.onversionchange = () => {
          opened.close()
          if (database === opened) {
            database = null
            opening = null
          }
        }
        return opened
      })
      .catch((error: unknown) => {
        opening = null
        throw error
      })
  }
  return opening
}

function connect(): Promise<IDBDatabase> {
  const factory = globalThis.indexedDB
  if (!factory) return Promise.reject(new StorageError('private'))
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      opening = null
      reject(mapStorageError(error))
    }
    let request: IDBOpenDBRequest
    try {
      request = factory.open(DB_NAME, DB_VERSION)
    } catch (error) {
      fail(error)
      return
    }
    request.onupgradeneeded = (event) => {
      applySchema(request.result, event.oldVersion)
    }
    request.onsuccess = () => {
      if (settled) return
      settled = true
      resolve(request.result)
    }
    request.onerror = () => fail(request.error)
    request.onblocked = () => fail(new StorageError('blocked'))
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      if (error === undefined) resolve()
      else reject(mapStorageError(error))
    }
    tx.oncomplete = () => finish()
    tx.onabort = () => finish(tx.error ?? new DOMException('aborted', 'AbortError'))
    tx.onerror = () => finish(tx.error)
  })
}

export async function withStore<T>(
  name: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDatabase()
  const tx = db.transaction(name, mode)
  try {
    const value = await run(tx.objectStore(name))
    await txDone(tx)
    return value
  } catch (error) {
    try {
      tx.abort()
    } catch {
      // Already finished or aborted by the failing request.
    }
    throw mapStorageError(error)
  }
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(mapStorageError(request.error))
  })
}

export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return withStore(store, 'readonly', async (objectStore) => {
    const value = await requestToPromise(objectStore.get(key))
    return value as T | undefined
  })
}

export async function idbPut(store: StoreName, value: unknown): Promise<void> {
  await withStore(store, 'readwrite', async (objectStore) => {
    await requestToPromise(objectStore.put(value))
  })
}

export async function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  await withStore(store, 'readwrite', async (objectStore) => {
    await requestToPromise(objectStore.delete(key))
  })
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  return withStore(store, 'readonly', async (objectStore) => {
    const value = await requestToPromise(objectStore.getAll())
    return value as T[]
  })
}

export async function idbGetAllByIndex<T>(store: StoreName, indexName: string, query: IDBValidKey): Promise<T[]> {
  return withStore(store, 'readonly', async (objectStore) => {
    const value = await requestToPromise(objectStore.index(indexName).getAll(query))
    return value as T[]
  })
}

export async function idbDeleteRange(store: StoreName, range: IDBKeyRange): Promise<void> {
  await withStore(store, 'readwrite', async (objectStore) => {
    await deleteCursor(objectStore.openCursor(range))
  })
}

function deleteCursor(request: IDBRequest<IDBCursorWithValue | null>): Promise<void> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(mapStorageError(request.error))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      const deletion = cursor.delete()
      deletion.onerror = () => reject(mapStorageError(deletion.error))
      deletion.onsuccess = () => cursor.continue()
    }
  })
}
