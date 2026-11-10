import { PERSONAL_MODE_LABEL } from '../personal/modes'
import type { PersonalMode } from '../personal/types'
import type { GameSource, UserColor } from '../storage/types'

export function liveSource(selfPlay: boolean, personal: boolean): GameSource {
  if (selfPlay) return 'app-calculator'
  return personal ? 'vs-personal' : 'app-free'
}

/** Personal games are always White for the user. Calculator games are both. */
export function liveUserColor(selfPlay: boolean): UserColor {
  return selfPlay ? 'both' : 'w'
}

export function livePlayers(
  selfPlay: boolean,
  personal: boolean,
  mode: PersonalMode | undefined,
): { event: string; white: string; black: string } {
  if (selfPlay) return { event: 'Kalkulačka', white: 'Hráč', black: 'Hráč' }
  if (personal) return { event: 'Hra proti sobě', white: 'Hráč', black: PERSONAL_MODE_LABEL[mode ?? 'today'] }
  return { event: 'Volná hra', white: 'Hráč', black: 'Stockfish' }
}
