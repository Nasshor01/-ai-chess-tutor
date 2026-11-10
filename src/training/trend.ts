export interface Rollup {
  gameId: string
  updatedAt: number
  userMoves: number
  themes: Record<string, number>
}

const MIN_MOVES = 8

/** Keeps one row per game and only the latest 40. */
export function foldRollups(previous: Rollup[], next: Rollup): Rollup[] {
  return [...previous.filter((row) => row.gameId !== next.gameId), next].sort((a, b) => a.updatedAt - b.updatedAt).slice(-40)
}

export function trendLines(rollups: Rollup[]): string[] {
  if (rollups.length < 2) return ['zatím málo dat']
  const mid = Math.floor(rollups.length / 2)
  const older = sum(rollups.slice(0, mid))
  const newer = sum(rollups.slice(mid))
  const themes = new Set([...Object.keys(older.themes), ...Object.keys(newer.themes)])
  if (themes.size === 0) return ['zatím málo dat']
  return [...themes].sort().map((theme) => lineFor(theme, older, newer))
}

function lineFor(theme: string, older: Sum, newer: Sum): string {
  if (older.userMoves < MIN_MOVES || newer.userMoves < MIN_MOVES) return `${theme}: zatím málo dat`
  const before = (older.themes[theme] ?? 0) / older.userMoves
  const after = (newer.themes[theme] ?? 0) / newer.userMoves
  const from = percent(before)
  const to = percent(after)
  if (after < before - 0.02) return `${theme}: opakuje se míň (${from} % → ${to} %)`
  if (after > before + 0.02) return `${theme}: opakuje se víc (${from} % → ${to} %)`
  return `${theme}: bez výrazné změny (${to} %)`
}

interface Sum {
  userMoves: number
  themes: Record<string, number>
}

function sum(rows: Rollup[]): Sum {
  const themes: Record<string, number> = {}
  let userMoves = 0
  for (const row of rows) {
    userMoves += row.userMoves
    for (const [theme, count] of Object.entries(row.themes)) themes[theme] = (themes[theme] ?? 0) + count
  }
  return { userMoves, themes }
}

function percent(value: number): number {
  return Math.round(value * 100)
}
