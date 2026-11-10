import { idbGet, idbPut } from './db'
import { enqueue } from './queue'
import type { KvRecord } from './types'

export function readKv(key: string): Promise<unknown> {
  return enqueue(async () => {
    const row = await idbGet<KvRecord>('kv', key)
    return row?.value ?? null
  })
}

export function writeKv(key: string, value: unknown): Promise<void> {
  return enqueue(() => idbPut('kv', { key, value }))
}
