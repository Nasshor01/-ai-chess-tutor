import { idbDelete, idbGet, idbPut } from './db'
import { enqueue } from './queue'
import type { AnalysisCacheRecord, KvRecord } from './types'

export const ANALYSIS_JOB_KEY = 'analysis:job'

export function readAnalysisCache(key: string): Promise<AnalysisCacheRecord | null> {
  return enqueue(async () => {
    const row = await idbGet<AnalysisCacheRecord>('analysisCache', key)
    if (!row || typeof row.key !== 'string' || typeof row.payload !== 'string') return null
    return row
  })
}

export function writeAnalysisCache(record: AnalysisCacheRecord): Promise<void> {
  return enqueue(() => idbPut('analysisCache', record))
}

export function readAnalysisJob(): Promise<unknown> {
  return enqueue(async () => {
    const row = await idbGet<KvRecord>('kv', ANALYSIS_JOB_KEY)
    return row?.value ?? null
  })
}

export function writeAnalysisJob(value: unknown): Promise<void> {
  return enqueue(async () => {
    if (value === null) await idbDelete('kv', ANALYSIS_JOB_KEY)
    else await idbPut('kv', { key: ANALYSIS_JOB_KEY, value })
  })
}
