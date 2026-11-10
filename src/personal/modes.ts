import type { StyleMetric, StyleProfile } from '../profile/styleProfile'
import type { DatedProfile, PersonalMode } from './types'

/** Same floor as docs/style-metrics.md. Below it the bot does not invent a style. */
export const STYLE_MIN_MOVES = 20
export const MONTH_MS = 30 * 86_400_000

/** At most one percentage point per day, so a short gap cannot explode the projection. */
const MAX_POINTS_PER_DAY = 1
const TRAIN_HORIZON_DAYS = 30

export const PERSONAL_MODE_LABEL: Record<PersonalMode, string> = {
  today: 'Já dnes',
  'month-ago': 'Já před měsícem',
  trained: 'Já po měsíci tréninku',
}

export interface ResolvedMode {
  available: boolean
  unavailableReason: string | null
  profile: StyleProfile | null
  weakModel: boolean
  notice: string | null
}

export function styleSamples(profile: StyleProfile | null): number {
  return profile?.metrics.find((metric) => metric.id === 'develop')?.samples ?? 0
}

export function isWeakProfile(profile: StyleProfile | null): boolean {
  if (!profile) return true
  if (styleSamples(profile) < STYLE_MIN_MOVES) return true
  return profile.metrics.every((metric) => metric.value == null)
}

const WEAK_NOTICE = 'O tvém stylu je zatím málo dat. Hraju slabší obecný model, ne podle tvých partií.'

/**
 * "Já před měsícem" needs a snapshot at least 30 days old.
 * "Já po měsíci tréninku" needs two snapshots and shifts the newer one by the capped trend.
 * A weak profile stays available: the bot says so and ignores the style.
 */
export function resolveMode(args: {
  mode: PersonalMode
  now: number
  profile: StyleProfile | null
  snapshots: DatedProfile[]
}): ResolvedMode {
  if (args.mode === 'month-ago') {
    const older = args.snapshots
      .filter((snapshot) => args.now - snapshot.createdAt >= MONTH_MS)
      .sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!older) {
      return {
        available: false,
        unavailableReason: 'Režim „Já před měsícem“ potřebuje snímek stylu starý aspoň 30 dní. Zatím takový není.',
        profile: null,
        weakModel: true,
        notice: null,
      }
    }
    return finish(older.profile)
  }

  if (args.mode === 'trained') {
    if (args.snapshots.length < 2) {
      return {
        available: false,
        unavailableReason: 'Režim „Já po měsíci tréninku“ potřebuje aspoň dva snímky stylu, aby šel spočítat trend.',
        profile: null,
        weakModel: true,
        notice: null,
      }
    }
    return finish(projectProfile(args.snapshots))
  }

  return finish(args.profile)
}

function finish(profile: StyleProfile | null): ResolvedMode {
  const weakModel = isWeakProfile(profile)
  return {
    available: true,
    unavailableReason: null,
    profile,
    weakModel,
    notice: weakModel ? WEAK_NOTICE : null,
  }
}

/**
 * Linear extrapolation of each share, 30 days past the newer snapshot.
 * A metric that is null on either snapshot stays null.
 * The daily change is capped at ±1 point. Values stay inside 0–100.
 * This is not a claim that training caused the change, and it does not invent fewer mistakes.
 */
export function projectProfile(snapshots: DatedProfile[]): StyleProfile {
  const sorted = [...snapshots].sort((a, b) => a.createdAt - b.createdAt)
  const older = sorted[0]?.profile
  const newer = sorted[sorted.length - 1]?.profile
  const from = sorted[0]?.createdAt ?? 0
  const to = sorted[sorted.length - 1]?.createdAt ?? from
  const days = Math.max(1, (to - from) / 86_400_000)
  if (!newer) return { weight: 0, metrics: [] }
  return {
    weight: newer.weight,
    metrics: newer.metrics.map((metric) => projectMetric(metric, older, days)),
  }
}

function projectMetric(metric: StyleMetric, older: StyleProfile | undefined, days: number): StyleMetric {
  const previous = older?.metrics.find((item) => item.id === metric.id)
  if (metric.value == null || previous?.value == null) return { ...metric, value: null }
  const rawDaily = (metric.value - previous.value) / days
  const daily = Math.max(-MAX_POINTS_PER_DAY, Math.min(MAX_POINTS_PER_DAY, rawDaily))
  const projected = Math.round(Math.max(0, Math.min(100, metric.value + daily * TRAIN_HORIZON_DAYS)))
  return { ...metric, value: projected }
}
