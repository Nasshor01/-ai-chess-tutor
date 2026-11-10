import type { EngineLine } from './types'

/**
 * Parses one `info ... pv ...` line. Score bounds (`lowerbound` / `upperbound`)
 * are ignored: the centipawn or mate value is still the number after `cp` / `mate`.
 * Lines without a principal variation (including `score mate 0`) return null.
 */
export function parseInfo(line: string): EngineLine | null {
  const tokens = line.split(' ')
  let depth = 0
  let multipv = 1
  let cp: number | null = null
  let mate: number | null = null
  let pv: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        depth = Number(tokens[++i])
        break
      case 'multipv':
        multipv = Number(tokens[++i])
        break
      case 'score': {
        const kind = tokens[++i]
        const value = Number(tokens[++i])
        if (kind === 'cp') cp = value
        else if (kind === 'mate') mate = value
        break
      }
      case 'pv':
        pv = tokens.slice(i + 1).filter((token) => token.length > 0)
        i = tokens.length
        break
      default:
        break
    }
  }
  if (pv.length === 0) return null
  return { multipv, depth, cp, mate, pv }
}
