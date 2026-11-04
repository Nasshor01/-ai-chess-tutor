import type { GameSummary } from '../tutor/summary'
import { QUALITY_LABEL } from '../tutor/classify'
import type { MoveQuality } from '../tutor/types'
import { Modal } from './Modal'
import './SummaryDialog.css'

interface Props {
  summary: GameSummary
  onNewGame: () => void
  onClose: () => void
}

const QUALITIES: MoveQuality[] = ['book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']

export function SummaryDialog({ summary, onNewGame, onClose }: Props) {
  const accuracy = summary.accuracy ?? 0
  const maxCount = Math.max(1, ...QUALITIES.map((q) => summary.counts[q]))

  return (
    <Modal
      title="Rozbor partie"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Prohlédnout partii
          </button>
          <button type="button" className="btn btn--primary" onClick={onNewGame}>
            Nová hra
          </button>
        </>
      }
    >
      <div className={`summary__hero outcome-${summary.outcome}`}>
        <div>
          <h3>{summary.title}</h3>
          <p>{summary.subtitle}</p>
        </div>
        {summary.accuracy !== null && (
          <div className="summary__accuracy" style={{ ['--value' as string]: accuracy }}>
            <span>{accuracy} %</span>
            <small>přesnost</small>
          </div>
        )}
      </div>

      {summary.userMoves > 0 && (
        <div className="summary__section">
          <h4>Tvoje tahy ({summary.userMoves})</h4>
          <div className="summary__bars">
            {QUALITIES.filter((q) => summary.counts[q] > 0).map((q) => (
              <div key={q} className="summary__bar">
                <span className={`summary__bar-label q-${q}`}>{QUALITY_LABEL[q]}</span>
                <span className="summary__bar-track">
                  <span className={`summary__bar-fill fill-${q}`} style={{ width: `${(summary.counts[q] / maxCount) * 100}%` }} />
                </span>
                <span className="summary__bar-count">{summary.counts[q]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="summary__grid">
        {summary.biggestMistake && (
          <div className="summary__box tone-bad">
            <h4>
              Klíčový moment · <span className="summary__move">{summary.biggestMistake.label}</span>
            </h4>
            <p>{summary.biggestMistake.text}</p>
          </div>
        )}
        {summary.bestMoment && (
          <div className="summary__box tone-good">
            <h4>
              Nejlepší chvíle · <span className="summary__move">{summary.bestMoment.label}</span>
            </h4>
            <p>{summary.bestMoment.text}</p>
          </div>
        )}
      </div>

      {summary.strengths.length > 0 && (
        <div className="summary__section">
          <h4>Co se ti povedlo</h4>
          <ul className="summary__list summary__list--good">
            {summary.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.improvements.length > 0 && (
        <div className="summary__section">
          <h4>Na čem zapracovat</h4>
          <ul className="summary__list summary__list--improve">
            {summary.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.concepts.length > 0 && (
        <div className="summary__section">
          <h4>Pojmy z této partie</h4>
          <div className="comment__tags">
            {summary.concepts.map((c) => (
              <span key={c} className="tag">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="summary__advice">{summary.advice}</p>
    </Modal>
  )
}
