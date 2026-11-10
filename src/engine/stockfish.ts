import { FULL_SKILL, analysisRequest, findCached, type AnalysisCacheEntry } from './cache'
import type { EngineLine, EngineResult } from './types'
import { parseInfo } from './uci'

const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`

export class EngineCancelledError extends Error {
  constructor() {
    super('Engine job cancelled')
    this.name = 'EngineCancelledError'
  }
}

export interface SearchOptions {
  depth: number
  /** Hard time cap in ms, so slow (mobile) devices stay responsive. */
  movetime?: number
  multipv?: number
  /** Stockfish "Skill Level" 0–20. Undefined = full strength. */
  skill?: number
}

interface Job {
  fen: string
  options: SearchOptions
  resolve: (result: EngineResult) => void
  reject: (error: Error) => void
}

/**
 * Thin UCI wrapper around a Stockfish Web Worker.
 * Searches run one at a time; extra requests are queued.
 */
export class StockfishEngine {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private queue: Job[] = []
  private current: Job | null = null
  private lines = new Map<number, EngineLine>()
  private currentSkill: number | null = null
  private currentMultiPv = 1
  private cache: AnalysisCacheEntry[] = []
  private inflight = new Map<string, Promise<EngineResult>>()
  private listeners = new Set<(line: string) => void>()
  private pendingNewGame = false

  init(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker(ENGINE_URL)
      } catch (error) {
        reject(error as Error)
        return
      }
      this.worker.onmessage = (event: MessageEvent) => this.handleLine(String(event.data))
      this.worker.onerror = (event) => reject(new Error(event.message || 'Stockfish se nepodařilo načíst'))

      const onLine = (line: string) => {
        if (line === 'uciok') {
          this.send('setoption name Hash value 16')
          this.send('isready')
        } else if (line === 'readyok') {
          this.listeners.delete(onLine)
          resolve()
        }
      }
      this.listeners.add(onLine)
      this.send('uci')
    })
    return this.ready
  }

  /** Full-strength analysis. Reduced skill is never cached or searched here. */
  async analyze(fen: string, options: SearchOptions): Promise<EngineResult> {
    const request = analysisRequest(fen, options, FULL_SKILL)
    const cached = findCached(this.cache, request)
    if (cached) return cached.result
    const key = `${request.fen}|${request.depth}|${request.multipv}|${request.movetime ?? ''}|${request.skill}`
    const running = this.inflight.get(key)
    if (running) return running
    const promise = this.enqueue(fen, { ...options, skill: undefined })
      .then((result) => {
        this.cache.push({
          fen,
          requestedDepth: request.depth,
          achievedDepth: result.depth,
          multipv: result.multipv,
          movetime: request.movetime,
          skill: FULL_SKILL,
          result,
        })
        return result
      })
      .finally(() => this.inflight.delete(key))
    this.inflight.set(key, promise)
    return promise
  }

  /** Ask the engine to choose a move, optionally with reduced strength. */
  async bestMove(fen: string, options: SearchOptions): Promise<EngineResult> {
    return this.enqueue(fen, { ...options, multipv: 1 })
  }

  /**
   * Skill-limited MultiPV search for the personal bot.
   * Reduced skill is sent to the engine and the result is not cached as full-strength analysis.
   * analyze() stays at full strength.
   */
  async search(fen: string, options: SearchOptions): Promise<EngineResult> {
    return this.enqueue(fen, options)
  }

  /** Clears the hash table and result cache before the next search (stale hash entries distort mate distances). */
  resetGame(): void {
    this.cache = []
    this.pendingNewGame = true
  }

  /** Drops queued jobs and stops the running search. */
  cancelAll(): void {
    const pending = this.queue
    this.queue = []
    pending.forEach((job) => job.reject(new EngineCancelledError()))
    if (this.current) this.send('stop')
  }

  terminate(): void {
    this.cancelAll()
    this.worker?.terminate()
    this.worker = null
    this.ready = null
  }

  private enqueue(fen: string, options: SearchOptions): Promise<EngineResult> {
    return new Promise<EngineResult>((resolve, reject) => {
      this.queue.push({ fen, options, resolve, reject })
      void this.pump()
    })
  }

  private async pump(): Promise<void> {
    if (this.current || this.queue.length === 0) return
    const job = this.queue.shift()!
    this.current = job
    try {
      await this.init()
    } catch (error) {
      this.current = null
      job.reject(error as Error)
      return
    }

    const skill = job.options.skill ?? 20
    if (skill !== this.currentSkill) {
      this.send(`setoption name Skill Level value ${skill}`)
      this.currentSkill = skill
    }
    const multipv = job.options.multipv ?? 1
    if (multipv !== this.currentMultiPv) {
      this.send(`setoption name MultiPV value ${multipv}`)
      this.currentMultiPv = multipv
    }

    this.lines.clear()
    if (this.pendingNewGame) {
      this.pendingNewGame = false
      this.send('ucinewgame')
    }
    this.send(`position fen ${job.fen}`)
    const movetime = job.options.movetime ? ` movetime ${job.options.movetime}` : ''
    this.send(`go depth ${job.options.depth}${movetime}`)
  }

  private handleLine(line: string): void {
    this.listeners.forEach((listener) => listener(line))

    if (line.startsWith('info') && line.includes(' pv ')) {
      const parsed = parseInfo(line)
      if (parsed) this.lines.set(parsed.multipv, parsed)
      return
    }
    if (line.startsWith('info depth 0') && line.includes('score mate 0')) {
      this.lines.set(1, { multipv: 1, depth: 0, cp: null, mate: 0, pv: [] })
      return
    }
    if (line.startsWith('bestmove')) {
      const job = this.current
      this.current = null
      if (job) {
        const best = line.split(' ')[1]
        const lines = [...this.lines.values()].sort((a, b) => a.multipv - b.multipv)
        job.resolve({
          fen: job.fen,
          bestMove: best && best !== '(none)' ? best : null,
          lines,
          depth: lines.reduce((max, l) => Math.max(max, l.depth), 0),
          requestedDepth: job.options.depth,
          multipv: job.options.multipv ?? 1,
        })
      }
      void this.pump()
    }
  }

  private send(command: string): void {
    this.worker?.postMessage(command)
  }
}
