import { idbGet, idbPut, requestToPromise, withStore } from './db'
import { StorageError } from './errors'
import { enqueue } from './queue'
import type { KvRecord, MigrationRecord, MigrationSnapshot } from './types'

export const SETTINGS_KEY = 'ai-chess-tutor:settings'
export const CONCEPTS_KEY = 'ai-chess-tutor:concepts'
export const SOLVED_KEY = 'ai-chess-tutor:solved-puzzles'
export const CALCULATOR_KEY = 'ai-chess-tutor:calculator'
export const MIGRATION_KEY = 'ai-chess-tutor:migration'

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
const MODES = ['free', 'opening', 'mate'] as const

export interface StoredSettings {
  difficulty: (typeof DIFFICULTIES)[number]
  mode: (typeof MODES)[number]
  openingId: string | null
  puzzleId: string | null
}

export interface LocalBackup {
  getItem(key: string): string | null
}

export interface MigratedSettings {
  settings: StoredSettings | null
  concepts: Record<string, number> | null
  solvedPuzzles: string[] | null
  calculator: boolean | null
}

interface Desired {
  settings?: StoredSettings
  concepts?: Record<string, number>
  solvedPuzzles?: string[]
  calculator?: boolean
  skipped: string[]
}

export function parseSettings(raw: string): StoredSettings | null {
  const value = parseJson(raw)
  if (!isRecord(value)) return null
  const difficulty = value.difficulty
  const mode = value.mode
  if (!isOneOf(difficulty, DIFFICULTIES) || !isOneOf(mode, MODES)) return null
  const openingId = value.openingId
  const puzzleId = value.puzzleId
  if (!(openingId === null || typeof openingId === 'string')) return null
  if (!(puzzleId === null || typeof puzzleId === 'string')) return null
  return { difficulty, mode, openingId, puzzleId }
}

export function parseConcepts(raw: string): Record<string, number> | null {
  const value = parseJson(raw)
  if (!isRecord(value)) return null
  const concepts: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return null
    concepts[key] = entry
  }
  return concepts
}

export function parseSolved(raw: string): string[] | null {
  const value = parseJson(raw)
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null
  return [...value]
}

export function parseCalculator(raw: string): boolean | null {
  if (raw === '1') return true
  if (raw === '0') return false
  return null
}

export function migrateFromLocalStorage(backup: LocalBackup): Promise<MigrationRecord> {
  return enqueue(() => migrateBody(backup))
}

export function loadMigratedSettings(): Promise<MigratedSettings> {
  return enqueue(readMigratedSettings)
}

async function migrateBody(backup: LocalBackup): Promise<MigrationRecord> {
  const existing = await readMigration()
  if (existing?.status === 'verified') return existing

  const snapshot = readSnapshot(backup)
  const desired = desiredFrom(snapshot)
  let matches = await desiredMatches(desired)
  if (!matches) {
    await writeDesired(desired, snapshot, 'written')
    matches = await desiredMatches(desired)
  }
  if (!matches) {
    await writeDesired(desired, snapshot, 'written')
    matches = await desiredMatches(desired)
  }
  if (!matches) throw new StorageError('unknown')

  const verified: MigrationRecord = { status: 'verified', snapshot, skipped: desired.skipped }
  await idbPut('kv', { key: MIGRATION_KEY, value: verified })
  return verified
}

export async function readMigratedSettings(): Promise<MigratedSettings> {
  const [settings, concepts, solvedPuzzles, calculator] = await Promise.all([
    readValue(SETTINGS_KEY, isStoredSettings),
    readValue(CONCEPTS_KEY, isConcepts),
    readValue(SOLVED_KEY, isSolved),
    readValue(CALCULATOR_KEY, isBoolean),
  ])
  return { settings, concepts, solvedPuzzles, calculator }
}

export function rememberSettings(value: StoredSettings): Promise<void> {
  return enqueue(() => idbPut('kv', { key: SETTINGS_KEY, value }))
}

export function rememberConcepts(value: Record<string, number>): Promise<void> {
  return enqueue(() => idbPut('kv', { key: CONCEPTS_KEY, value }))
}

export function rememberSolved(value: string[]): Promise<void> {
  return enqueue(() => idbPut('kv', { key: SOLVED_KEY, value }))
}

export function rememberCalculator(value: boolean): Promise<void> {
  return enqueue(() => idbPut('kv', { key: CALCULATOR_KEY, value }))
}

async function readMigration(): Promise<MigrationRecord | null> {
  const row = await idbGet<KvRecord>('kv', MIGRATION_KEY)
  return isMigration(row?.value) ? row.value : null
}

function readSnapshot(backup: LocalBackup): MigrationSnapshot {
  return {
    settings: readItem(backup, SETTINGS_KEY),
    concepts: readItem(backup, CONCEPTS_KEY),
    solvedPuzzles: readItem(backup, SOLVED_KEY),
    calculator: readItem(backup, CALCULATOR_KEY),
  }
}

function readItem(backup: LocalBackup, key: string): string | null {
  try {
    return backup.getItem(key)
  } catch (error) {
    throw new StorageError('unknown', error)
  }
}

function desiredFrom(snapshot: MigrationSnapshot): Desired {
  const desired: Desired = { skipped: [] }
  take(snapshot.settings, SETTINGS_KEY, parseSettings, (value) => (desired.settings = value), desired)
  take(snapshot.concepts, CONCEPTS_KEY, parseConcepts, (value) => (desired.concepts = value), desired)
  take(snapshot.solvedPuzzles, SOLVED_KEY, parseSolved, (value) => (desired.solvedPuzzles = value), desired)
  take(snapshot.calculator, CALCULATOR_KEY, parseCalculator, (value) => (desired.calculator = value), desired)
  return desired
}

function take<T>(raw: string | null, key: string, parse: (value: string) => T | null, set: (value: T) => void, desired: Desired): void {
  if (raw === null) return
  const parsed = parse(raw)
  if (parsed === null) desired.skipped.push(key)
  else set(parsed)
}

async function desiredMatches(desired: Desired): Promise<boolean> {
  if (desired.settings !== undefined && !same(await readLoose(SETTINGS_KEY), desired.settings)) return false
  if (desired.concepts !== undefined && !same(await readLoose(CONCEPTS_KEY), desired.concepts)) return false
  if (desired.solvedPuzzles !== undefined && !same(await readLoose(SOLVED_KEY), desired.solvedPuzzles)) return false
  if (desired.calculator !== undefined && !same(await readLoose(CALCULATOR_KEY), desired.calculator)) return false
  return true
}

async function writeDesired(desired: Desired, snapshot: MigrationSnapshot, status: 'written'): Promise<void> {
  const record: MigrationRecord = { status, snapshot, skipped: desired.skipped }
  await withStore('kv', 'readwrite', async (store) => {
    if (desired.settings !== undefined) await requestToPromise(store.put({ key: SETTINGS_KEY, value: desired.settings }))
    if (desired.concepts !== undefined) await requestToPromise(store.put({ key: CONCEPTS_KEY, value: desired.concepts }))
    if (desired.solvedPuzzles !== undefined) await requestToPromise(store.put({ key: SOLVED_KEY, value: desired.solvedPuzzles }))
    if (desired.calculator !== undefined) await requestToPromise(store.put({ key: CALCULATOR_KEY, value: desired.calculator }))
    await requestToPromise(store.put({ key: MIGRATION_KEY, value: record }))
  })
}

async function readLoose(key: string): Promise<unknown> {
  const row = await idbGet<KvRecord>('kv', key)
  return row?.value
}

async function readValue<T>(key: string, guard: (value: unknown) => value is T): Promise<T | null> {
  const value = await readLoose(key)
  return guard(value) ? value : null
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.some((item) => item === value)
}

function isStoredSettings(value: unknown): value is StoredSettings {
  if (!isRecord(value)) return false
  return (
    isOneOf(value.difficulty, DIFFICULTIES) &&
    isOneOf(value.mode, MODES) &&
    (value.openingId === null || typeof value.openingId === 'string') &&
    (value.puzzleId === null || typeof value.puzzleId === 'string')
  )
}

function isConcepts(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'number' && Number.isFinite(entry))
}

function isSolved(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isMigration(value: unknown): value is MigrationRecord {
  if (!isRecord(value)) return false
  if (value.status !== 'written' && value.status !== 'verified') return false
  if (!Array.isArray(value.skipped) || value.skipped.some((item) => typeof item !== 'string')) return false
  return isRecord(value.snapshot)
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
