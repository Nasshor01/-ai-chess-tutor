import { idbGet, idbGetAll, idbPut } from '../storage/db'
import { enqueue } from '../storage/queue'
import type { KvRecord, TrainingItem } from '../storage/types'
import type { TrainingCard } from './items'
import type { Rollup } from './trend'

const ROLLUPS_KEY = 'learning:rollups'

export function loadCards(): Promise<TrainingCard[]> {
  return enqueue(async () => {
    const rows = await idbGetAll<TrainingItem>('trainingItems')
    return rows.flatMap((row) => {
      const card = parseCard(row.payload)
      return card ? [card] : []
    })
  })
}

export function saveCards(cards: TrainingCard[]): Promise<void> {
  return enqueue(async () => {
    for (const card of cards) {
      const row: TrainingItem = { id: card.id, createdAt: card.createdAt, payload: JSON.stringify(card) }
      await idbPut('trainingItems', row)
    }
  })
}

export function loadRollups(): Promise<Rollup[]> {
  return enqueue(async () => {
    const row = await idbGet<KvRecord>('kv', ROLLUPS_KEY)
    if (!Array.isArray(row?.value)) return []
    return row.value.filter(isRollup)
  })
}

export function saveRollups(rows: Rollup[]): Promise<void> {
  return enqueue(() => idbPut('kv', { key: ROLLUPS_KEY, value: rows }))
}

function parseCard(payload: string): TrainingCard | null {
  try {
    const value: unknown = JSON.parse(payload)
    if (typeof value !== 'object' || value === null) return null
    const card = value as TrainingCard
    if (typeof card.id !== 'string' || typeof card.fen !== 'string' || typeof card.solutionUci !== 'string') return null
    return card
  } catch {
    return null
  }
}

function isRollup(value: unknown): value is Rollup {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Rollup
  return typeof row.gameId === 'string' && typeof row.userMoves === 'number' && typeof row.themes === 'object' && row.themes !== null
}
