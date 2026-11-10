const DAY = 86_400_000

export interface Sm2State {
  repetition: number
  intervalDays: number
  ease: number
  dueAt: number
}

/**
 * SuperMemo 2.
 * `again` is quality 1: the card goes back to repetition 0 and is due tomorrow.
 * `good` is quality 4: the interval is 1 day, then 6, then the previous interval times the new ease.
 * Ease never drops below 1.3. A failed card therefore returns sooner than a remembered one.
 */
export function reviewSm2(card: Sm2State, grade: 'again' | 'good', now: number): Sm2State {
  const quality = grade === 'good' ? 4 : 1
  let ease = card.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease < 1.3) ease = 1.3
  if (quality < 3) {
    return { repetition: 0, intervalDays: 1, ease, dueAt: now + DAY }
  }
  const repetition = card.repetition + 1
  const intervalDays = card.repetition <= 0 ? 1 : card.repetition === 1 ? 6 : Math.max(1, Math.round(card.intervalDays * ease))
  return { repetition, intervalDays, ease, dueAt: now + intervalDays * DAY }
}

export function freshSchedule(now: number): Sm2State {
  return { repetition: 0, intervalDays: 0, ease: 2.5, dueAt: now }
}
