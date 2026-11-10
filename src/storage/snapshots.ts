import { idbGetAll, idbPut } from './db'
import { enqueue } from './queue'
import type { EloSnapshot, PlayerProfileSnapshot } from './types'

type SnapshotStore = 'eloSnapshots' | 'profileSnapshots'
type Snapshot = EloSnapshot | PlayerProfileSnapshot

export function saveSnapshot(store: SnapshotStore, record: Snapshot): Promise<void> {
  return enqueue(() => idbPut(store, record))
}

export function listSnapshots(store: SnapshotStore): Promise<Snapshot[]> {
  return enqueue(async () => {
    const rows = await idbGetAll<Snapshot>(store)
    return rows.filter((row) => typeof row?.id === 'string' && typeof row.createdAt === 'number').sort((a, b) => a.createdAt - b.createdAt)
  })
}

export function latestSnapshot(store: SnapshotStore): Promise<Snapshot | null> {
  return enqueue(async () => {
    const rows = await idbGetAll<Snapshot>(store)
    const valid = rows.filter((row) => typeof row?.id === 'string' && typeof row.createdAt === 'number')
    valid.sort((a, b) => b.createdAt - a.createdAt)
    return valid[0] ?? null
  })
}
