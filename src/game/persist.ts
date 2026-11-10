import { Chess, DEFAULT_POSITION, type Move } from 'chess.js'
import { parseUci, toUci } from '../chess/utils'
import { reportStorageFailure } from '../storage/errors'
import { commitLiveGame, liveDedupKey, newGameId, readActiveGame, setActiveGameId } from '../storage/games'
import { exportPgn, pgnDate } from '../storage/pgn'
import type { Game, GameResult, MoveRecord } from '../storage/types'
import type { GameEndReason, GameOutcome } from '../tutor/summary'
import { livePlayers, liveSource, liveUserColor } from './liveRecord'
import type { GameMode, PlyRecord } from './types'
import type { PersonalMode } from '../personal/types'

export interface LiveSlot {
  id: { current: string | null }
  createdAt: { current: number | null }
  startFen: { current: string }
}

export function createLiveSlot(): LiveSlot {
  return {
    id: { current: null },
    createdAt: { current: null },
    startFen: { current: DEFAULT_POSITION },
  }
}

export function resultFor(outcome: GameOutcome, reason: GameEndReason, userColor: 'w' | 'b' | 'both'): GameResult {
  if (reason === 'resign') return userColor === 'b' ? '1-0' : '0-1'
  if (outcome === 'draw') return '1/2-1/2'
  return outcome === 'win' ? '1-0' : '0-1'
}

/** Drops the active pointer. The saved game itself stays in the list. */
export function abandonLiveGame(slot: LiveSlot): void {
  slot.id.current = null
  slot.createdAt.current = null
  slot.startFen.current = DEFAULT_POSITION
  void setActiveGameId(null).catch((error: unknown) => reportStorageFailure(error))
}

export function rememberLiveGame(args: {
  slot: LiveSlot
  gen: number
  genNow: () => number
  mode: GameMode
  selfPlay: boolean
  personal: boolean
  personalMode?: PersonalMode
  plies: PlyRecord[]
  finished: { outcome: GameOutcome; reason: GameEndReason } | null
}): void {
  if (args.mode !== 'free') return
  if (!args.slot.id.current) {
    args.slot.id.current = newGameId()
    args.slot.createdAt.current = Date.now()
  }
  const id = args.slot.id.current
  const createdAt = args.slot.createdAt.current ?? Date.now()
  const startFen = args.slot.startFen.current || DEFAULT_POSITION
  const userColor = liveUserColor(args.selfPlay)
  const names = livePlayers(args.selfPlay, args.personal, args.personalMode)
  const result = args.finished ? resultFor(args.finished.outcome, args.finished.reason, userColor) : '*'
  const event = names.event
  const white = names.white
  const black = names.black
  const records: MoveRecord[] = args.plies.map((ply) => ({
    gameId: id,
    ply: ply.index,
    fenBefore: ply.move.before,
    uci: toUci(ply.move),
    san: ply.move.san,
    byUser: ply.byUser,
  }))
  let pgn = ''
  try {
    pgn = exportPgn({
      startFen,
      uci: records.map((record) => record.uci),
      event,
      site: 'AI Chess Tutor',
      date: pgnDate(createdAt),
      white,
      black,
      result,
    })
  } catch (error) {
    reportStorageFailure(error)
    return
  }
  const game: Game = {
    id,
    pgn,
    result,
    userColor,
    source: liveSource(args.selfPlay, args.personal),
    createdAt,
    updatedAt: Date.now(),
    status: result === '*' ? 'in-progress' : 'finished',
    headers: {
      Event: event,
      Site: 'AI Chess Tutor',
      Date: pgnDate(createdAt),
      White: white,
      Black: black,
      Result: result,
      ...(startFen !== DEFAULT_POSITION ? { SetUp: '1', FEN: startFen } : {}),
    },
    startFen,
    dedupKey: liveDedupKey(id),
    plyCount: records.length,
  }
  void commitLiveGame(game, records, () => args.genNow() === args.gen && args.slot.id.current === id).catch((error: unknown) => {
    reportStorageFailure(error)
  })
}

export function loadRestorableGame(): Promise<{ game: Game; moves: MoveRecord[] } | null> {
  return readActiveGame().catch((error: unknown) => {
    reportStorageFailure(error)
    return null
  })
}

/** Replays onto `chess`. On a bad record the board is put back and the function returns null. */
export function replaySavedGame(chess: Chess, startFen: string, records: MoveRecord[]): PlyRecord[] | null {
  const backup = chess.fen()
  try {
    chess.load(startFen || DEFAULT_POSITION)
    const plies: PlyRecord[] = []
    for (const record of records) {
      const move: Move = chess.move(parseUci(record.uci))
      plies.push({ index: plies.length, move, byUser: record.byUser })
    }
    return plies
  } catch {
    try {
      chess.load(backup)
    } catch {
      chess.reset()
    }
    return null
  }
}
