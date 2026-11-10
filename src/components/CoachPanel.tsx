import { useState } from 'react'
import { analyst } from '../engine/engines'
import { linesFrom, suggestWhatIWouldPlay } from '../game/personalTurn'
import { teachingMove } from '../coach/teach'
import { BulbIcon, SparkIcon } from './Icons'
import './CoachPanel.css'

interface Props {
  fen: string
  /** Known rating, when the user typed one. Null uses the wider learning budget. */
  elo: number | null
}

type Mode = 'predict' | 'improve'

export function CoachPanel({ fen, elo }: Props) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [text, setText] = useState<{ fen: string; mode: Mode; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const visible = text && text.fen === fen && text.mode === mode ? text.text : null

  const ask = (next: Mode) => {
    setMode(next)
    setBusy(true)
    const job = next === 'predict' ? suggestWhatIWouldPlay(fen) : recommend(fen, elo)
    void job
      .then((line) => setText({ fen, mode: next, text: line }))
      .catch(() => setText({ fen, mode: next, text: 'Teď to nejde spočítat. Zkus to znovu za chvíli.' }))
      .finally(() => setBusy(false))
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
      {visible && <p className={`coach__text is-${mode}`}>{visible}</p>}
    </section>
  )
}

async function recommend(fen: string, elo: number | null): Promise<string> {
  const result = await analyst.analyze(fen, { depth: 12, multipv: 4, movetime: 700 })
  const choice = teachingMove({ fen, lines: linesFrom(result), elo, weakness: null })
  if (!choice) return 'V téhle pozici nemám tah, který by stálo za to se učit.'
  return `${choice.san}. ${choice.reason}`
}
