import type { Score } from '../engine/types'
import { describeScore, formatScore, winChance } from '../chess/utils'
import type { EngineStatus, PlayerColor } from '../game/types'
import './EvalMeter.css'

interface Props {
  evaluation: Score | null
  analysing: boolean
  engineStatus: EngineStatus
  openingName: string | null
  /** True when the same person plays both colours. */
  bothSides?: boolean
  /** Whose pieces the player moves. White is the free-play default. */
  userColor?: PlayerColor
}

export function EvalMeter({ evaluation, analysing, engineStatus, openingName, bothSides = false, userColor = 'w' }: Props) {
  const white = evaluation ? winChance(evaluation) : 50
  const label = evaluation ? formatScore(evaluation) : '0.0'
  const description =
    engineStatus === 'loading'
      ? 'Načítám šachový engine…'
      : engineStatus === 'error'
        ? 'Engine není k dispozici.'
        : evaluation
          ? describeScore(evaluation, bothSides ? 'both' : userColor)
          : 'Pozice je vyrovnaná.'

  return (
    <section className="card eval" aria-label="Hodnocení pozice">
      <div className="eval__header">
        <div className="eval__copy">
          <h2 className="card__title">Hodnocení pozice</h2>
          <p className="eval__description">{description}</p>
        </div>
        <div className={`eval__score ${evaluation && evaluation.cp < 0 ? 'is-black' : ''}`}>{label}</div>
      </div>
      <div
        className="eval__bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(white)}
        aria-label="Šance bílého"
      >
        <div className="eval__fill" style={{ width: `${white}%` }} />
        <div className="eval__mid" />
      </div>
      <div className="eval__footer">
        <span>{bothSides ? 'Bílý' : userColor === 'b' ? 'Počítač' : 'Ty (bílý)'} {Math.round(white)} %</span>
        {analysing ? (
          <span className="eval__analysing">
            <span className="spinner" aria-hidden="true" /> Trenér analyzuje…
          </span>
        ) : (
          openingName && <span className="eval__opening">{openingName}</span>
        )}
        <span>{bothSides ? 'Černý' : userColor === 'b' ? 'Ty (černý)' : 'Počítač'} {Math.round(100 - white)} %</span>
      </div>
    </section>
  )
}
