export type StorageReason = 'quota' | 'blocked' | 'private' | 'aborted' | 'unknown'

const MESSAGES: Record<StorageReason, string> = {
  quota: 'Úložiště prohlížeče je plné. Tahle partie se neukládá. Smaž staré partie v Moje partie, nebo je exportuj a uvolni místo.',
  private: 'Ukládání partií je v tomhle prohlížeči vypnuté. Nastavení zůstává jen v záloze prohlížeče a historie partií se neuloží.',
  blocked: 'Úložiště je otevřené v jiné kartě. Zavři ostatní karty s trenérem a obnov stránku.',
  aborted: 'Uložení partie bylo přerušeno. Zkus to znovu.',
  unknown: 'Partii se nepodařilo uložit.',
}

export function storageWarning(reason: StorageReason): string {
  return MESSAGES[reason]
}

export class StorageError extends Error {
  readonly reason: StorageReason

  constructor(reason: StorageReason, cause?: unknown) {
    super(storageWarning(reason))
    this.name = 'StorageError'
    this.reason = reason
    if (cause !== undefined) this.cause = cause
  }
}

/**
 * Firefox in private mode rejects IndexedDB with UnknownError or InvalidStateError.
 * A missing factory is handled before this runs.
 */
export function mapStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  const name = errorName(error)
  if (name === 'QuotaExceededError') return new StorageError('quota', error)
  if (name === 'VersionError') return new StorageError('blocked', error)
  if (name === 'AbortError') return new StorageError('aborted', error)
  if (name === 'SecurityError' || name === 'InvalidStateError' || name === 'UnknownError') {
    return new StorageError('private', error)
  }
  return new StorageError('unknown', error)
}

function errorName(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) return error.name
  return ''
}

type WarningListener = (warning: string | null) => void

const listeners = new Set<WarningListener>()
let currentWarning: string | null = null

export function subscribeStorageWarning(listener: WarningListener): () => void {
  listeners.add(listener)
  listener(currentWarning)
  return () => listeners.delete(listener)
}

export function currentStorageWarning(): string | null {
  return currentWarning
}

export function reportStorageFailure(error: unknown): StorageError {
  const mapped = mapStorageError(error)
  currentWarning = mapped.message
  for (const listener of listeners) listener(currentWarning)
  return mapped
}

export function clearStorageWarning(): void {
  currentWarning = null
  for (const listener of listeners) listener(null)
}
