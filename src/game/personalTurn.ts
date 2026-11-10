import type { EngineResult } from '../engine/types'
import { calculatorEngine } from '../engine/engines'
import { createPersonalProvider } from '../personal/provider'
import { personalStrength } from '../personal/strength'
import type { DatedProfile, PersonalHistory, PersonalLine, PersonalMode, PersonalMoveResult, PersonalStrength, PersonalStrengthId } from '../personal/types'
import { styleProfile, type StyleProfile } from '../profile/styleProfile'
import { listGames, movesFor } from '../storage/games'
import { listSnapshots } from '../storage/snapshots'

export interface PersonalMaterial {
  profile: StyleProfile | null
  snapshots: DatedProfile[]
  history: PersonalHistory[]
}

export async function loadPersonalMaterial(now = Date.now()): Promise<PersonalMaterial> {
  const games = await listGames()
  const styleGames = []
  const history: PersonalHistory[] = []
  for (const game of games) {
    const moves = await movesFor(game.id)
    styleGames.push({
      updatedAt: game.updatedAt,
      moves: moves.map((move) => ({ fenBefore: move.fenBefore, uci: move.uci, byUser: move.byUser })),
    })
    for (const move of moves) {
      if (!move.byUser) continue
      const quality = move.category?.split('|')[0]
      history.push({
        placement: move.fenBefore.split(' ')[0] ?? '',
        fenBefore: move.fenBefore,
        uci: move.uci,
        mistake: quality === 'mistake' || quality === 'blunder',
      })
    }
  }
  const snapshots: DatedProfile[] = []
  for (const row of await listSnapshots('profileSnapshots')) {
    const profile = parseProfile(row.payload)
    if (profile) snapshots.push({ createdAt: row.createdAt, profile })
  }
  return {
    profile: styleGames.length === 0 ? null : styleProfile(styleGames, now),
    snapshots,
    history: history.slice(-500),
  }
}

export async function playPersonalMove(args: {
  fen: string
  mode: PersonalMode
  strength: PersonalStrengthId
  search: (fen: string, strength: PersonalStrength) => Promise<PersonalLine[]>
  now?: number
  rng?: () => number
}): Promise<PersonalMoveResult> {
  const now = args.now ?? Date.now()
  let material: PersonalMaterial = { profile: null, snapshots: [], history: [] }
  try {
    material = await loadPersonalMaterial(now)
  } catch {
    // Storage failed. The provider will say the style is missing.
  }
  let lines: PersonalLine[] = []
  try {
    lines = await args.search(args.fen, personalStrength(args.strength))
  } catch {
    lines = []
  }
  return createPersonalProvider().choose({
    fen: args.fen,
    mode: args.mode,
    strength: args.strength,
    now,
    profile: material.profile,
    snapshots: material.snapshots,
    history: material.history,
    lines,
    rng: args.rng,
  })
}

export function formatPersonalNote(result: PersonalMoveResult): string {
  if (!result.available) return result.unavailableReason ?? 'Ten režim teď nejde.'
  if (!result.played) return result.notice ?? 'Nemám tah.'
  return [result.played.reason, result.notice].filter((part) => part && part.length > 0).join(' ')
}

/** Calculator suggestion. It does not replace options A, B and C, and it does not call analyze(). */
export async function suggestWhatIWouldPlay(fen: string): Promise<string> {
  const result = await playPersonalMove({
    fen,
    mode: 'today',
    strength: 'match',
    search: async (position, strength) => linesFrom(await calculatorEngine.search(position, strength)),
  })
  if (!result.played) return result.unavailableReason ?? result.notice ?? 'Teď nemám vlastní tah.'
  const percent = Math.round(result.played.probability * 100)
  const notice = result.notice ? ` ${result.notice}` : ''
  return `Co bych zahrál já: ${result.played.san} (${percent} %). ${result.played.reason}.${notice}`
}

export function linesFrom(result: EngineResult): PersonalLine[] {
  const lines = result.lines
    .map((line) => ({ uci: line.pv[0] ?? '', cp: line.cp, mate: line.mate }))
    .filter((line) => line.uci.length >= 4)
  if (lines.length > 0) return lines
  if (!result.bestMove) return []
  return [{ uci: result.bestMove, cp: result.lines[0]?.cp ?? null, mate: result.lines[0]?.mate ?? null }]
}

function parseProfile(payload: string): StyleProfile | null {
  try {
    const value: unknown = JSON.parse(payload)
    if (typeof value !== 'object' || value === null) return null
    const record = value as { weight?: unknown; metrics?: unknown }
    if (typeof record.weight !== 'number' || !Array.isArray(record.metrics)) return null
    return record as StyleProfile
  } catch {
    return null
  }
}
