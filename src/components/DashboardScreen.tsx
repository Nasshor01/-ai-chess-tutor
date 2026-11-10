import { useEffect, useState } from 'react'
import { eloLine, radarPoints } from '../elo/charts'
import { estimateElo, snapshotPayload, type EloEstimate } from '../elo/estimate'
import { listGames, movesFor } from '../storage/games'
import { listSnapshots, saveSnapshot } from '../storage/snapshots'
import type { GamePhase } from '../storage/types'
import './DashboardScreen.css'

const ANCHOR_KEY = 'ai-chess-tutor:anchor'
const MONTH = 30 * 86_400_000

interface Point {
  at: number
  elo: number
}

interface Props {
  onImport: () => void
  onReview: () => void
}

const PHASES: Array<{ id: GamePhase; label: string }> = [
  { id: 'opening', label: 'Zahájení' },
  { id: 'middlegame', label: 'Střed' },
  { id: 'endgame', label: 'Koncovka' },
]

export function DashboardScreen({ onImport, onReview }: Props) {
  const [anchor, setAnchor] = useState(() => localStorage.getItem(ANCHOR_KEY) ?? '')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [gamesCount, setGamesCount] = useState(0)
  const [estimate, setEstimate] = useState<EloEstimate | null>(null)
  const [history, setHistory] = useState<Point[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const life = { cancelled: false }
    const rating = Number(anchor)
    void listGames()
      .then(async (games) => {
        const full = []
        for (const game of games) full.push({ ...game, moves: await movesFor(game.id) })
        const next = estimateElo(full, { anchor: Number.isFinite(rating) && rating >= 400 ? rating : undefined })
        const snaps = await listSnapshots('eloSnapshots')
        return { games: games.length, next, snaps }
      })
      .then(async ({ games, next, snaps }) => {
        if (life.cancelled) return
        setGamesCount(games)
        setEstimate(next)
        setHistory(
          snaps.flatMap((row) => {
            const elo = eloFrom(row.payload)
            return elo == null ? [] : [{ at: row.createdAt, elo }]
          }),
        )
        setNow(Date.now())
        setStatus('ready')
        const today = new Date().toDateString()
        if (next.elo != null && !snaps.some((row) => new Date(row.createdAt).toDateString() === today)) {
          await saveSnapshot('eloSnapshots', snapshotPayload(next, Date.now()))
        }
      })
      .catch(() => {
        if (!life.cancelled) setStatus('error')
      })
    return () => {
      life.cancelled = true
    }
  }, [anchor, retry])

  const month = [...history].reverse().find((point) => now - point.at >= MONTH) ?? null
  const scored = estimate?.subscores.filter((score) => score.value != null) ?? []

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <h2 id="dashboard-title">Dashboard</h2>
      <label className="dashboard__anchor">
        Známý rating (volitelný)
        <input
          inputMode="numeric"
          value={anchor}
          placeholder="např. 1500"
          onChange={(event) => {
            setStatus('loading')
            setAnchor(event.target.value)
            localStorage.setItem(ANCHOR_KEY, event.target.value)
          }}
        />
      </label>

      {status === 'loading' && (
        <div className="dashboard__grid" aria-busy="true">
          <div className="skeleton skeleton--card" />
          <div className="skeleton skeleton--card" />
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="dashboard__warn">
          <p>Dashboard se nepodařilo načíst.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setStatus('loading')
              setRetry((value) => value + 1)
            }}
          >
            Zkusit znovu
          </button>
        </div>
      )}
      {status === 'ready' && gamesCount === 0 && (
        <div className="dashboard__empty">
          <h3>Importuj první partie</h3>
          <p>Bez partií není z čeho počítat Elo ani styl. Soubor musí být PGN v UTF-8.</p>
          <button type="button" className="btn btn--primary" onClick={onImport}>
            Importovat PGN
          </button>
        </div>
      )}
      {status === 'ready' && gamesCount > 0 && (!estimate || estimate.elo === null) && (
        <div className="dashboard__empty">
          <h3>Chybí rozbor</h3>
          <p>Partie už tu jsou, ale žádný tvůj tah ještě nemá ztrátu v centipawnech.</p>
          <button type="button" className="btn btn--primary" onClick={onReview}>
            Otevřít rozbor
          </button>
        </div>
      )}
      {status === 'ready' && estimate && estimate.elo !== null && (
        <div className="dashboard__grid">
          <article className="dashboard__card">
            <h3>Osobní Elo</h3>
            <p className="dashboard__elo">
              {estimate.elo}
              <small>
                {estimate.low}–{estimate.high}
              </small>
            </p>
            <Interval spread={estimate.high != null && estimate.low != null ? (estimate.high - estimate.low) / 2 : 0} />
            <p>{estimate.anchored ? 'Ukotveno na zadaný rating.' : 'Bez zadaného ratingu je kotva 1500.'}</p>
            <p>
              Průměrná ztráta {estimate.acpl} cp z {estimate.games} partií.
            </p>
            {estimate.thin && <p className="dashboard__warn">Míň než 20 analyzovaných partií. Interval je široký a odhad je nejistý.</p>}
            {month && (
              <p>
                Před měsícem {month.elo}. Teď {estimate.elo > month.elo ? 'výš' : estimate.elo < month.elo ? 'níž' : 'stejně'} o{' '}
                {Math.abs(estimate.elo - month.elo)}.
              </p>
            )}
            {!month && <p>Snímek starý aspoň měsíc ještě není, takže srovnání chybí.</p>}
          </article>

          <article className="dashboard__card">
            <h3>Vývoj</h3>
            {history.length < 2 ? (
              <p>Na křivku jsou potřeba aspoň dva snímky.</p>
            ) : (
              <svg className="dashboard__chart" viewBox="0 0 280 120" role="img" aria-label="Vývoj odhadu Elo">
                <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={eloLine(history.map((point) => point.elo), 280, 120)} />
              </svg>
            )}
          </article>

          <article className="dashboard__card">
            <h3>Podskóre</h3>
            {scored.length < 3 ? (
              <p>Radar chce aspoň tři podskóre s daty. Ostatní se nezobrazují.</p>
            ) : (
              <svg className="dashboard__chart" viewBox="0 0 220 220" role="img" aria-label="Radar podskóre">
                <polygon points={radarPoints(scored.map(() => 100), 110, 110, 70)} fill="none" stroke="var(--border-strong)" />
                <polygon points={radarPoints(scored.map((score) => score.value ?? 0), 110, 110, 70)} fill="var(--accent-soft)" stroke="var(--accent)" />
                {scored.map((score, index) => {
                  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / scored.length
                  return (
                    <text key={score.id} x={110 + 88 * Math.cos(angle)} y={110 + 88 * Math.sin(angle)} textAnchor="middle" fill="var(--text)" fontSize="10">
                      {score.label}
                    </text>
                  )
                })}
              </svg>
            )}
            <ul>
              {estimate.subscores
                .filter((score) => score.value != null || score.detail)
                .map((score) => (
                  <li key={score.id}>
                    {score.label}: {score.value != null ? `${score.value} %` : score.detail} ({score.samples} tahů)
                  </li>
                ))}
            </ul>
          </article>

          <article className="dashboard__card">
            <h3>Chyby podle fáze</h3>
            <svg className="dashboard__chart" viewBox="0 0 300 90" role="img" aria-label="Podíl chyb v zahájení, středu a koncovce">
              {PHASES.map((phase, index) => {
                const share = estimate.byPhase[phase.id]
                return (
                  <g key={phase.id} transform={`translate(${index * 100},0)`}>
                    <rect width="92" height="54" rx="8" fill={heatFill(share)} stroke={heatStroke(share)} />
                    <text x="46" y="24" textAnchor="middle" fill="var(--text)" fontSize="12">
                      {phase.label}
                    </text>
                    <text x="46" y="42" textAnchor="middle" fill="var(--text)" fontSize="12">
                      {share == null ? 'málo dat' : `${Math.round(share * 100)} %`}
                    </text>
                  </g>
                )
              })}
            </svg>
          </article>
        </div>
      )}
    </section>
  )
}

function Interval({ spread }: { spread: number }) {
  const width = Math.max(8, Math.min(100, (spread / 400) * 100))
  return (
    <svg className="dashboard__interval" viewBox="0 0 100 16" role="img" aria-label={`Interval nejistoty plus minus ${Math.round(spread)}`}>
      <rect x={(100 - width) / 2} y="4" width={width} height="8" rx="4" fill="var(--accent)" />
    </svg>
  )
}

function heatFill(share: number | null): string {
  if (share == null) return 'var(--surface-3)'
  if (share < 0.15) return 'var(--good-soft)'
  if (share < 0.35) return 'var(--average-soft)'
  return 'var(--bad-soft)'
}

function heatStroke(share: number | null): string {
  if (share == null) return 'var(--border)'
  if (share < 0.15) return 'var(--good)'
  if (share < 0.35) return 'var(--average)'
  return 'var(--bad)'
}

function eloFrom(payload: string): number | null {
  try {
    const value: unknown = JSON.parse(payload)
    if (typeof value !== 'object' || value === null) return null
    const elo = (value as { elo?: unknown }).elo
    return typeof elo === 'number' ? elo : null
  } catch {
    return null
  }
}
