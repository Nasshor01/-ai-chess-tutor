import { chooseStatistical } from './statistical'
import type { PersonalMoveProvider } from './types'

/**
 * NEURAL DROP-IN. Not implemented.
 * A Maia policy (lc0) or a net fine-tuned on the user's PGNs would implement
 * PersonalMoveProvider with id 'maia' and the same PersonalInput / PersonalMoveResult.
 * createPersonalProvider() is the only place that picks an implementation.
 * Screens and the game loop must not import statistical.ts or branch on the id.
 */
export const NEURAL_PROVIDER_ID = 'maia' as const

const statistical: PersonalMoveProvider = {
  id: 'statistical',
  choose: chooseStatistical,
}

export function createPersonalProvider(): PersonalMoveProvider {
  return statistical
}
