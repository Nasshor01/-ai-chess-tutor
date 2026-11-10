import type { PersonalStrength, PersonalStrengthId } from './types'

/**
 * Skill and MultiPV for the personal bot's own search.
 * Tutor analysis keeps using analyze(), which stays at full strength.
 */
export const PERSONAL_STRENGTHS: Record<PersonalStrengthId, PersonalStrength> = {
  soft: { id: 'soft', label: 'Měkčí', skill: 0, depth: 4, movetime: 200, multipv: 5, temperature: 1.8 },
  match: { id: 'match', label: 'Jako já', skill: 4, depth: 8, movetime: 400, multipv: 4, temperature: 1.05 },
  sharp: { id: 'sharp', label: 'Ostřejší', skill: 12, depth: 12, movetime: 700, multipv: 3, temperature: 0.55 },
}

export function personalStrength(id: PersonalStrengthId | undefined): PersonalStrength {
  return PERSONAL_STRENGTHS[id ?? 'match'] ?? PERSONAL_STRENGTHS.match
}
