import { useEffect, useState } from 'react'
import { estimateElo, snapshotPayload, type EloEstimate } from '../elo/estimate'
import { listGames, movesFor } from '../storage/games'
import { latestSnapshot, saveSnapshot } from '../storage/snapshots'
import './DashboardScreen.css'

const ANCHOR_KEY = 'ai-chess-tutor:anchor'

export function DashboardScreen() {
  const [anchor, setAnchor] = useState(() => localStorage.getItem(ANCHOR_KEY) ?? '')
  const [estimate, setEstimate] = useState<EloEstimate | null>(null)

  useEffect(() => {
    const life = { cancelled: false }
    const rating = Number(anchor)
    void listGames()
      .then(async (games) => {
        const full = []
        for (const game of games) full.push({ ...game, moves: await movesFor(game.id) })
        return estimateElo(full, { anchor: Number.isFinite(rating) && rating >= 400 ? rating : undefined })
      })
      .then(async (next) => {
        if (life.cancelled) return
        setEstimate(next)
        const latest = await latestSnapshot('eloSnapshots')
        const today = new Date().toDateString()
        if (!latest || new Date(latest.createdAt).toDateString() !== today) {
          await saveSnapshot('eloSnapshots', snapshotPayload(next, Date.now()))
        }
      })
      .catch(() => {
        if (!life.cancelled) setEstimate(null)
      })
    return () => {
      life.cancelled = true
    }
  }, [anchor])

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <h2 id="dashboard-title">Odhad Elo</h2>
      <label className="dashboard__anchor">
        Známý rating (volitelný)
        <input
          inputMode="numeric"
          value={anchor}
          placeholder="např. 1500"
          onChange={(event) => {
            setAnchor(event.target.value)
            localStorage.setItem(ANCHOR_KEY, event.target.value)
          }}
        />
      </label>
      {!estimate || estimate.elo === null ? (
        <p>Až bude aspoň jeden tvůj tah ohodnocený v rozboru, objeví se odhad.</p>
      ) : (
        <>
          <p className="dashboard__elo">
            {estimate.elo}
            <small>
              {estimate.low}–{estimate.high}
            </small>
          </p>
          <p>{estimate.anchored ? 'Ukotveno na zadaný rating.' : 'Bez zadaného ratingu je kotva 1500.'}</p>
          <p>Průměrná ztráta {estimate.acpl} cp z {estimate.games} partií.</p>
          {estimate.thin && <p className="dashboard__warn">Míň než 20 analyzovaných partií. Interval je široký a odhad je nejistý.</p>}
          <ul>
            {estimate.subscores
              .filter((score) => score.value != null || score.detail)
              .map((score) => (
                <li key={score.id}>
                  {score.label}: {score.value != null ? `${score.value} %` : score.detail} ({score.samples} tahů)
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  )
}
