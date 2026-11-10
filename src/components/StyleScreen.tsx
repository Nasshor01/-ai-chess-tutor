import { useEffect, useState } from 'react'
import { profileSnapshot, styleProfile, type StyleProfile } from '../profile/styleProfile'
import { listGames, movesFor } from '../storage/games'
import { listSnapshots, saveSnapshot } from '../storage/snapshots'
import './StyleScreen.css'

const MONTH = 30 * 86_400_000

export function StyleScreen() {
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  const [before, setBefore] = useState<StyleProfile | null>(null)

  useEffect(() => {
    const life = { cancelled: false }
    const now = Date.now()
    void listGames()
      .then(async (games) => {
        const full = []
        for (const game of games) {
          const moves = await movesFor(game.id)
          full.push({ updatedAt: game.updatedAt, moves: moves.map((move) => ({ fenBefore: move.fenBefore, uci: move.uci, byUser: move.byUser })) })
        }
        return styleProfile(full, now)
      })
      .then(async (next) => {
        if (life.cancelled) return
        setProfile(next)
        const saved = await listSnapshots('profileSnapshots')
        const monthAgo = [...saved].reverse().find((row) => row.createdAt <= now - MONTH)
        if (monthAgo) {
          const parsed: unknown = JSON.parse(monthAgo.payload)
          if (isProfile(parsed)) setBefore(parsed)
        }
        const today = new Date(now).toDateString()
        const already = saved.some((row) => new Date(row.createdAt).toDateString() === today)
        if (!already) await saveSnapshot('profileSnapshots', profileSnapshot(next, now))
      })
      .catch(() => {
        if (!life.cancelled) setProfile(null)
      })
    return () => {
      life.cancelled = true
    }
  }, [])

  return (
    <section className="style" aria-labelledby="style-title">
      <h2 id="style-title">Můj styl</h2>
      <p>Čísla jsou podíl tahů nebo partií. Novější partie váží víc, každého měsíce o polovinu. Když je vzorků málo, číslo se neukáže.</p>
      {!profile ? (
        <p>Styl se nepodařilo spočítat.</p>
      ) : (
        <ul>
          {profile.metrics.map((metric) => {
            const earlier = before?.metrics.find((item) => item.id === metric.id)
            return (
              <li key={metric.id}>
                <strong>{metric.label}</strong>
                <span>{metric.value === null ? 'málo dat' : `${metric.value} %`}</span>
                {earlier?.value != null && metric.value != null && <small>před měsícem {earlier.value} %</small>}
                <p>{metric.explain}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function isProfile(value: unknown): value is StyleProfile {
  return typeof value === 'object' && value !== null && Array.isArray((value as StyleProfile).metrics)
}
