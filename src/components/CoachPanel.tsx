import { useEffect, useState } from 'react'
import type { PieceSymbol, Square } from 'chess.js'
import { czSan, parseUci } from '../chess/utils'
import { analyst } from '../engine/engines'
import { linesFrom, suggestPersonalMove } from '../game/personalTurn'
import type { MoveInput } from '../game/types'
import { teachingMove } from '../coach/teach'
import { BOARD_ARROWS } from '../ui/markers'
import { BulbIcon, SparkIcon } from './Icons'
import './CoachPanel.css'

interface Props {
  fen: string
  /** Known rating, when the user typed one. Null uses the wider learning budget. */
  elo: number | null
  onArrow: (arrow: { from: string; to: string; color: string } | null) => void
  onPlay: (move: MoveInput) => void
}

type Mode = 'predict' | 'improve'

interface Advice {
  fen: string
  mode: Mode
  san: string | null
  from?: Square
  to?: Square
  promotion?: PieceSymbol
  reason: string
}

export function CoachPanel({ fen, elo, onArrow, onPlay }: Props) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [busy, setBusy] = useState(false)
  const visible = advice && advice.fen === fen && advice.mode === mode ? advice : null

  useEffect(() => {
    if (visible?.from && visible.to) {
      onArrow({
        from: visible.from,
        to: visible.to,
        color: visible.mode === 'predict' ? BOARD_ARROWS.predict : BOARD_ARROWS.improve,
      })
      return
    }
    onArrow(null)
  }, [onArrow, visible])

  const ask = (next: Mode) => {
    setMode(next)
    setBusy(true)
    const job = next === 'predict' ? predict(fen) : recommend(fen, elo)
    void job
      .then((nextAdvice) => setAdvice(nextAdvice))
      .catch(() => setAdvice({ fen, mode: next, san: null, reason: 'Teď to nejde spočítat. Zkus to znovu za chvíli.' }))
      .finally(() => setBusy(false))
  }

  const close = () => {
    setAdvice(null)
    setMode(null)
  }

  return (
    <section className="card coach" aria-label="Trenér">
      <h2 className="card__title">Trenér</h2>
      <div className="coach__modes">
        <button type="button" className={`coach__mode is-predict ${mode === 'predict' ? 'is-on' : ''}`} aria-pressed={mode === 'predict'} disabled={busy} onClick={() => ask('predict')}>
          <SparkIcon width={16} height={16} />
          Co bych zahrál já?
        </button>
        <button type="button" className={`coach__mode is-improve ${mode === 'improve' ? 'is-on' : ''}`} aria-pressed={mode === 'improve'} disabled={busy} onClick={() => ask('improve')}>
          <BulbIcon width={16} height={16} />
          Co mám zahrát, abych se zlepšil?
        </button>
      </div>
      {busy && <p className="coach__text">Počítám…</p>}
      {visible && (
        <article className={`coach-card is-${visible.mode}`}>
          <h3>{visible.san ? czSan(visible.san) : 'Bez návrhu'}</h3>
          <p>{visible.reason}</p>
          <div className="coach-card__actions">
            {visible.from && visible.to && (
              <button
                type="button"
                className="btn btn--small coach-card__play"
                onClick={() => {
                  onPlay({ from: visible.from!, to: visible.to!, promotion: visible.promotion })
                  close()
                }}
              >
                Zahrát
              </button>
            )}
            <button type="button" className="btn btn--small" onClick={close}>
              Zavřít
            </button>
          </div>
        </article>
      )}
    </section>
  )
}

async function predict(fen: string): Promise<Advice> {
  const move = await suggestPersonalMove(fen)
  if (!move) return { fen, mode: 'predict', san: null, reason: 'Teď nemám vlastní tah.' }
  return {
    fen,
    mode: 'predict',
    san: move.san,
    from: move.from as Square,
    to: move.to as Square,
    promotion: move.promotion as PieceSymbol | undefined,
    reason: `${move.reason} (${move.percent} %)`,
  }
}

async function recommend(fen: string, elo: number | null): Promise<Advice> {
  const result = await analyst.analyze(fen, { depth: 12, multipv: 4, movetime: 700 })
  const choice = teachingMove({ fen, lines: linesFrom(result), elo, weakness: null })
  if (!choice) return { fen, mode: 'improve', san: null, reason: 'V téhle pozici nemám tah, který by stálo za to se učit.' }
  const parsed = parseUci(choice.uci)
  return { fen, mode: 'improve', san: choice.san, from: parsed.from, to: parsed.to, promotion: parsed.promotion, reason: choice.reason }
}
