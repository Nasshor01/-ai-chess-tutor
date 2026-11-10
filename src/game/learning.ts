import { analysisSnapshot, subscribeAnalysis } from '../analysis/queue'
import { DEFAULT_ANALYSIS } from '../analysis/types'
import { estimateElo, snapshotPayload } from '../elo/estimate'
import { beginAnalysis, installAnalysis } from './analysisBridge'
import { profileSnapshot, styleProfile } from '../profile/styleProfile'
import { listGames, movesFor } from '../storage/games'
import { listSnapshots, saveSnapshot } from '../storage/snapshots'
import type { MoveRecord } from '../storage/types'
import { cardsFromMoves, mergeCards, themeOf, type SourceMove } from '../training/items'
import { loadCards, loadRollups, saveCards, saveRollups } from '../training/store'
import { foldRollups, type Rollup } from '../training/trend'

let enabled = false

/** The app turns this on. Unit tests leave it off so a finished game does not start Stockfish. */
export function enableLearning(): void {
  enabled = true
}

/**
 * Analyses only the game that just finished, then updates rollups, training cards
 * and the daily Elo and style snapshots from stored moves. It does not wait.
 */
export function scheduleLearning(gameId: string): void {
  if (!enabled) return
  installAnalysis()
  const stop = subscribeAnalysis(() => {
    const job = analysisSnapshot().job
    if (job?.gameId !== gameId || job.status !== 'done') return
    stop()
    void absorb(gameId).catch(() => undefined)
  })
  beginAnalysis(gameId, DEFAULT_ANALYSIS)
}

async function absorb(gameId: string): Promise<void> {
  const games = await listGames()
  const full = []
  for (const game of games) full.push({ game, moves: await movesFor(game.id) })
  const target = full.find((item) => item.game.id === gameId)
  if (!target) return
  const rollup: Rollup = {
    gameId,
    updatedAt: target.game.updatedAt,
    userMoves: target.moves.filter((move) => move.byUser).length,
    themes: themeCounts(target.moves),
  }
  const folded = foldRollups(await loadRollups(), rollup)
  await saveRollups(folded)
  const ids = new Set(folded.map((row) => row.gameId))
  const source = full
    .filter((item) => ids.has(item.game.id))
    .flatMap((item) => item.moves.map((move) => toSource(item.game.id, move)))
  await saveCards(mergeCards(await loadCards(), cardsFromMoves(source, Date.now())))
  await refreshSnapshots(full)
}

function themeCounts(moves: MoveRecord[]): Record<string, number> {
  const themes: Record<string, number> = {}
  for (const move of moves) {
    if (!move.byUser) continue
    const quality = move.category?.split('|')[0]
    if (quality !== 'mistake' && quality !== 'blunder') continue
    const theme = themeOf(move.category)
    themes[theme] = (themes[theme] ?? 0) + 1
  }
  return themes
}

function toSource(gameId: string, move: MoveRecord): SourceMove {
  return {
    gameId,
    ply: move.ply,
    fenBefore: move.fenBefore,
    uci: move.uci,
    san: move.san,
    byUser: move.byUser,
    category: move.category,
    bestUci: move.bestUci,
  }
}

async function refreshSnapshots(full: Array<{ game: Awaited<ReturnType<typeof listGames>>[number]; moves: MoveRecord[] }>): Promise<void> {
  const now = Date.now()
  const today = new Date(now).toDateString()
  const eloRows = await listSnapshots('eloSnapshots')
  if (!eloRows.some((row) => new Date(row.createdAt).toDateString() === today)) {
    const estimate = estimateElo(
      full.map(({ game, moves }) => ({
        id: game.id,
        result: game.result,
        userColor: game.userColor,
        source: game.source,
        updatedAt: game.updatedAt,
        moves,
      })),
    )
    await saveSnapshot('eloSnapshots', snapshotPayload(estimate, now))
  }
  const styleRows = await listSnapshots('profileSnapshots')
  if (!styleRows.some((row) => new Date(row.createdAt).toDateString() === today)) {
    const profile = styleProfile(
      full.map(({ game, moves }) => ({
        updatedAt: game.updatedAt,
        moves: moves.map((move) => ({ fenBefore: move.fenBefore, uci: move.uci, byUser: move.byUser })),
      })),
      now,
    )
    await saveSnapshot('profileSnapshots', profileSnapshot(profile, now))
  }
}
