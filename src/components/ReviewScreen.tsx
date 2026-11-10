import { useEffect, useState } from 'react'
import { QUALITY_LABEL } from '../tutor/classify'
import type { MoveQuality } from '../tutor/types'
import { analysisSnapshot, cancelAnalysis, pauseAnalysis, subscribeAnalysis } from '../analysis/queue'
import { DEFAULT_ANALYSIS, type AnalysisSettings } from '../analysis/types'
import { beginAnalysis, installAnalysis } from '../game/analysisBridge'
import { listGames, movesFor } from '../storage/games'
import type { Game, MoveRecord } from '../storage/types'
import type { BoardName } from '../ui/appearance'
import { coreCount, preferSharedEngine } from '../engine/engines'
import { ChessBoardView } from './ChessBoardView'
import './ReviewScreen.css'

const MISTAKES = new Set(['inaccuracy', 'mistake', 'blunder'])

function quality(category: string | undefined): string {
  return category?.split('|')[0] ?? ''
}

function motifs(category: string | undefined): string[] {
  return (category?.split('|').slice(1) ?? []).filter(Boolean)
}

interface Props {
  board: BoardName
}

export function ReviewScreen({ board }: Props) {
  const [games, setGames] = useState<Game[]>([])
  const [gameId, setGameId] = useState<string | null>(null)
  const [moves, setMoves] = useState<MoveRecord[]>([])
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_ANALYSIS)
  const [ply, setPly] = useState(0)
  const [tick, setTick] = useState(0)
  const snapshot = analysisSnapshot()
  void tick

  useEffect(() => installAnalysis(), [])
  useEffect(() => subscribeAnalysis(() => setTick((value) => value + 1)), [])
  useEffect(() => {
    void listGames().then(setGames)
  }, [snapshot.job?.status, snapshot.job?.nextPly])

  useEffect(() => {
    if (!gameId) return
    void movesFor(gameId).then((rows) => {
      setMoves(rows)
      setPly(0)
    })
  }, [gameId, snapshot.job?.nextPly, snapshot.job?.status])

  const current = moves[ply]
  const fen = current?.fenBefore ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const mistakes = moves.filter((move) => MISTAKES.has(quality(move.category)))
  const running = snapshot.job?.gameId === gameId && snapshot.job.status === 'running'
  const shared = preferSharedEngine(coreCount())

  return (
    <section className="review" aria-labelledby="review-title">
      <h2 id="review-title">Rozbor</h2>
      {shared && <p className="review__note">Na tomhle počítači má hra přednost. Rozbor počká, než počítač dohraje tah.</p>}
      {games.length === 0 ? (
        <p>Nejdřív ulož nebo importuj partii.</p>
      ) : (
        <label className="review__pick">
          Partie
          <select value={gameId ?? ''} onChange={(event) => setGameId(event.target.value || null)}>
            <option value="">Vyber partii</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.headers.Date} · {game.headers.White} – {game.headers.Black}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="review__settings">
        <label>
          Hloubka
          <input
            type="number"
            min={6}
            max={24}
            value={settings.depth}
            onChange={(event) => setSettings({ ...settings, depth: Number(event.target.value) })}
          />
        </label>
        <label>
          MultiPV
          <input
            type="number"
            min={1}
            max={5}
            value={settings.multipv}
            onChange={(event) => setSettings({ ...settings, multipv: Number(event.target.value) })}
          />
        </label>
        <label>
          Čas na tah (ms)
          <input
            type="number"
            min={100}
            max={10000}
            step={100}
            value={settings.movetime}
            onChange={(event) => setSettings({ ...settings, movetime: Number(event.target.value) })}
          />
        </label>
        <button type="button" className="btn btn--primary" disabled={!gameId || running} onClick={() => gameId && beginAnalysis(gameId, settings)}>
          Analyzovat
        </button>
        <button type="button" className="btn" disabled={!running} onClick={pauseAnalysis}>
          Pozastavit
        </button>
        <button type="button" className="btn" disabled={!snapshot.job} onClick={cancelAnalysis}>
          Zrušit
        </button>
      </div>
      {snapshot.job && (
        <p role="status">
          {snapshot.waiting
            ? 'Rozbor čeká, až hra uvolní engine.'
            : snapshot.job.status === 'paused'
              ? `Pozastaveno na tahu ${snapshot.job.nextPly + 1}.`
              : snapshot.job.status === 'done'
                ? 'Rozbor je hotový.'
                : `Hotovo ${snapshot.job.nextPly} tahů.`}
        </p>
      )}
      {moves.length > 0 && <EvalGraph moves={moves} active={ply} onPick={setPly} />}
      <div className="review__body">
        <ChessBoardView fen={fen} orientation="white" canMove={false} lastMove={null} inCheck={false} hint={null} board={board} onMove={() => false} />
        <div>
          {current && (
            <p>
              Tah {current.ply + 1}: {current.san}
              {current.category ? ` · ${label(quality(current.category))}` : ''}
              {current.cpLoss != null ? ` · ${current.cpLoss} cp` : ''}
              {current.winLoss != null ? ` · ${current.winLoss} %` : ''}
              {motifs(current.category).length > 0 ? ` · ${motifs(current.category).join(', ')}` : ''}
            </p>
          )}
          <ul className="review__mistakes">
            {mistakes.map((move) => (
              <li key={move.ply}>
                <button type="button" onClick={() => setPly(move.ply)}>
                  {move.san}: {label(quality(move.category))}
                  {move.winLoss != null ? ` (${move.winLoss} %)` : ''}
                </button>
              </li>
            ))}
          </ul>
          {gameId && mistakes.length === 0 && snapshot.job?.status === 'done' && <p>V téhle partii není nepřesnost, chyba ani hrubá chyba.</p>}
        </div>
      </div>
    </section>
  )
}

function label(name: string): string {
  if (name in QUALITY_LABEL) return QUALITY_LABEL[name as MoveQuality]
  return name
}

function EvalGraph({ moves, active, onPick }: { moves: MoveRecord[]; active: number; onPick: (ply: number) => void }) {
  const width = 640
  const height = 160
  const mid = height / 2
  const step = moves.length > 1 ? width / (moves.length - 1) : width
  const y = (cp: number) => mid - (Math.max(-800, Math.min(800, cp)) / 800) * (mid - 10)
  const points = moves.map((move, index) => `${index * step},${y(move.evalAfter ?? 0)}`).join(' ')
  return (
    <svg className="review__graph" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Graf hodnocení z pohledu bílého">
      <line x1="0" y1={mid} x2={width} y2={mid} stroke="currentColor" strokeOpacity="0.35" />
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {moves.map((move, index) => (
        <circle
          key={move.ply}
          cx={index * step}
          cy={y(move.evalAfter ?? 0)}
          r={active === index ? 6 : 4}
          tabIndex={0}
          role="button"
          aria-label={`Tah ${index + 1}, ${move.san}`}
          fill={MISTAKES.has(quality(move.category)) ? 'var(--bad)' : 'var(--accent)'}
          onClick={() => onPick(index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onPick(index)
          }}
        />
      ))}
    </svg>
  )
}
