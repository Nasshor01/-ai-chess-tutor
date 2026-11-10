// @vitest-environment jsdom
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_POSITION } from 'chess.js'
import { closeDatabase } from '../storage/db'
import { queueDepth, resetQueue } from '../storage/queue'
import { liveDedupKey, readActiveGame, saveGame, saveMove, setActiveGameId, whenStorageIdle } from '../storage/games'
import type { Game } from '../storage/types'
import type { EngineResult } from '../engine/types'
import { useChessGame } from './useChessGame'

const BACK_RANK = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
const BLACK_MATES = 'K7/8/k7/8/8/8/8/7r b - - 0 1'
const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1'

const engine = vi.hoisted(() => {
  const pending: Array<{ fen: string; resolve: (result: EngineResult) => void }> = []
  return {
    pending,
    analyze(fen: string) {
      return new Promise<EngineResult>((resolve) => {
        pending.push({ fen, resolve })
      })
    },
  }
})

vi.mock('../engine/engines', () => ({
  warmUpEngines: () => Promise.resolve(),
  analyst: {
    analyze: (fen: string) => engine.analyze(fen),
    bestMove: () => Promise.resolve({ bestMove: 'e7e5' }),
    cancelAll: () => undefined,
    resetGame: () => undefined,
    terminate: () => undefined,
  },
  opponent: {
    analyze: (fen: string) => engine.analyze(fen),
    bestMove: () => Promise.resolve({ bestMove: 'e7e5' }),
    cancelAll: () => undefined,
    resetGame: () => undefined,
    terminate: () => undefined,
  },
  calculatorEngine: {
    analyze: (fen: string) => engine.analyze(fen),
    bestMove: () => Promise.resolve({ bestMove: null }),
    cancelAll: () => undefined,
    resetGame: () => undefined,
    terminate: () => undefined,
  },
}))

function fake(fen: string): EngineResult {
  return { fen, bestMove: null, lines: [], depth: 12, requestedDepth: 12, multipv: 1 }
}

function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const slot: { api: ReturnType<typeof useChessGame> | null } = { api: null }
  function Harness(): ReactNode {
    slot.api = useChessGame()
    return null
  }
  act(() => {
    root.render(createElement(Harness))
  })
  return {
    get api() {
      if (!slot.api) throw new Error('hook is not mounted')
      return slot.api
    },
    unmount() {
      act(() => root.unmount())
      container.remove()
    },
  }
}

async function flushMount() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Resolves every analysis that is in flight, including ones started by the resolution itself. */
async function drain() {
  await act(async () => {
    for (let i = 0; i < 8; i++) {
      const batch = engine.pending.splice(0)
      for (const item of batch) item.resolve(fake(item.fen))
      await Promise.resolve()
      await Promise.resolve()
      if (engine.pending.length === 0) break
    }
    await Promise.resolve()
  })
}

let mounted: ReturnType<typeof mount> | null = null

beforeEach(() => {
  resetQueue()
  closeDatabase()
  globalThis.indexedDB = new IDBFactory()
  globalThis.IDBKeyRange = IDBKeyRange
  localStorage.clear()
  engine.pending.length = 0
  vi.useFakeTimers()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  closeDatabase()
  vi.clearAllTimers()
  vi.useRealTimers()
  resetQueue()
})

/** Flushes fake timers so IndexedDB's setImmediate and the storage queue can finish. */
async function pump<T>(work: Promise<T>): Promise<T> {
  let settled = false
  let failure: unknown
  const pending = work.then(
    (value) => {
      settled = true
      return value
    },
    (error: unknown) => {
      settled = true
      failure = error
      throw error
    },
  )
  for (let i = 0; i < 80 && !settled; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
  }
  if (!settled) throw new Error(`storage did not settle (timers=${vi.getTimerCount()} depth=${queueDepth()})`)
  if (failure) throw failure
  return pending
}

describe('useChessGame flows', () => {
  it('names the winner in the player’s voice after a normal mate', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      expect(mounted!.api.loadPosition(BACK_RANK)).toBe(true)
      mounted!.api.setSelfPlay(false)
    })
    act(() => {
      expect(mounted!.api.makeMove({ from: 'd1', to: 'd8' })).toBe(true)
    })
    await drain()
    expect(mounted.api.gameOver?.summary?.title).toBe('Vyhrál jsi matem!')
  })

  it('names which colour mated when the player is both sides', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      expect(mounted!.api.loadPosition(BACK_RANK)).toBe(true)
    })
    act(() => {
      expect(mounted!.api.makeMove({ from: 'd1', to: 'd8' })).toBe(true)
    })
    await drain()
    expect(mounted.api.gameOver?.summary?.title).toBe('Bílý dal mat')

    act(() => {
      expect(mounted!.api.loadPosition(BLACK_MATES)).toBe(true)
    })
    expect(mounted.api.selfPlay).toBe(true)
    act(() => {
      expect(mounted!.api.makeMove({ from: 'h1', to: 'h8' })).toBe(true)
    })
    await drain()
    expect(mounted.api.gameOver?.summary?.title).toBe('Černý dal mat')
  })

  it('rejects a move that leaves the opening book and keeps the position', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      mounted!.api.newGame({ mode: 'opening', openingId: 'italian' })
    })
    act(() => {
      expect(mounted!.api.makeMove({ from: 'e2', to: 'e4' })).toBe(true)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(mounted.api.plies.map((ply) => ply.move.san)).toEqual(['e4', 'e5'])
    act(() => {
      expect(mounted!.api.makeMove({ from: 'a2', to: 'a3' })).toBe(false)
    })
    expect(mounted.api.plies.map((ply) => ply.move.san)).toEqual(['e4', 'e5'])
    expect(mounted.api.messages.some((message) => message.kind === 'opening' && message.title.includes('není tah'))).toBe(true)
  })

  it('loads a FEN into self-play and lets the player move both colours', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      expect(mounted!.api.loadPosition(BLACK_TO_MOVE)).toBe(true)
    })
    expect(mounted.api.turn).toBe('b')
    expect(mounted.api.selfPlay).toBe(true)
    expect(mounted.api.messages.some((message) => message.kind === 'info' && message.text.includes('Na tahu je černý'))).toBe(true)
    act(() => {
      expect(mounted!.api.makeMove({ from: 'e7', to: 'e5' })).toBe(true)
      expect(mounted!.api.makeMove({ from: 'e2', to: 'e4' })).toBe(true)
    })
    expect(mounted.api.plies.map((ply) => ply.byUser)).toEqual([true, true])
    expect(mounted.api.turn).toBe('b')
  })

  it('does not store a comment that resolves after genRef moved on', async () => {
    mounted = mount()
    await flushMount()
    act(() => {
      expect(mounted!.api.makeMove({ from: 'e2', to: 'e4' })).toBe(true)
    })
    expect(engine.pending.length).toBeGreaterThan(0)
    act(() => {
      mounted!.api.undo()
    })
    expect(mounted.api.plies).toHaveLength(0)
    await drain()
    await pump(whenStorageIdle())
    expect(mounted.api.comments).toEqual({})
    expect(mounted.api.messages.some((message) => message.kind === 'comment')).toBe(false)
    expect((await pump(readActiveGame()))?.moves.map((move) => move.uci) ?? []).not.toContain('e2e4')
  })

  it('reloads an in-progress game once and drops it again on undo', async () => {
    const id = 'saved-game'
    const stored: Game = {
      id,
      pgn: '',
      result: '*',
      userColor: 'w',
      source: 'app-free',
      createdAt: 1,
      updatedAt: 1,
      status: 'in-progress',
      headers: { Event: 'Volná hra', Site: 'AI Chess Tutor', Date: '2026.11.10', White: 'Hráč', Black: 'Stockfish', Result: '*' },
      startFen: DEFAULT_POSITION,
      dedupKey: liveDedupKey(id),
      plyCount: 2,
    }
    await pump(saveGame(stored))
    await pump(saveMove({ gameId: id, ply: 0, fenBefore: DEFAULT_POSITION, uci: 'e2e4', san: 'e4', byUser: true }))
    await pump(saveMove({ gameId: id, ply: 1, fenBefore: DEFAULT_POSITION, uci: 'e7e5', san: 'e5', byUser: false }))
    await pump(setActiveGameId(id))

    mounted = mount()
    await flushMount()
    for (let i = 0; i < 10 && mounted.api.plies.length < 2; i += 1) await pump(whenStorageIdle())
    expect(mounted.api.plies.map((ply) => ply.move.san)).toEqual(['e4', 'e5'])
    expect(mounted.api.selfPlay).toBe(false)

    act(() => {
      mounted!.api.undo()
    })
    await pump(whenStorageIdle())
    expect(mounted.api.plies).toHaveLength(0)
    expect((await pump(readActiveGame()))?.moves ?? []).toHaveLength(0)
    await drain()
    expect(mounted.api.comments).toEqual({})
  })

  it('continues an in-progress game from the list without playing it twice', async () => {
    mounted = mount()
    await flushMount()
    await pump(whenStorageIdle())
    const id = 'continue-game'
    await pump(
      saveGame({
        id,
        pgn: '',
        result: '*',
        userColor: 'w',
        source: 'app-free',
        createdAt: 1,
        updatedAt: 1,
        status: 'in-progress',
        headers: { Event: 'Volná hra', Site: 'AI Chess Tutor', Date: '2026.11.10', White: 'Hráč', Black: 'Stockfish', Result: '*' },
        startFen: DEFAULT_POSITION,
        dedupKey: liveDedupKey(id),
        plyCount: 2,
      }),
    )
    await pump(saveMove({ gameId: id, ply: 0, fenBefore: DEFAULT_POSITION, uci: 'e2e4', san: 'e4', byUser: true }))
    await pump(saveMove({ gameId: id, ply: 1, fenBefore: DEFAULT_POSITION, uci: 'e7e5', san: 'e5', byUser: false }))
    expect(await pump(mounted.api.resumeGame(id))).toBe(true)
    expect(mounted.api.plies.map((ply) => ply.move.san)).toEqual(['e4', 'e5'])
    expect(mounted.api.plies).toHaveLength(2)
  })
})
