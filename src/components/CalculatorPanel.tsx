import type { CSSProperties } from 'react'
import { branchText } from '../calculator/calculator'
import { mateInText } from '../chess/utils'
import { optionColor, type Calculator } from '../calculator/useCalculator'
import { ArrowLeftIcon, ArrowRightIcon, CalculatorIcon, CloseIcon } from './Icons'
import './CalculatorPanel.css'

interface Props {
  calc: Calculator
  onSetup: () => void
  onAnalyze: () => void
}

export function CalculatorPanel({ calc, onSetup, onAnalyze }: Props) {
  const { enabled, result, preview } = calc

  return (
    <section className={`card calc ${enabled ? 'is-on' : ''} ${result?.finish ? 'is-finish' : ''}`} aria-label="Calculator Mode">
      <div className="calc__header">
        <div className="calc__title">
          <CalculatorIcon width={18} height={18} />
          <div>
            <h2>Calculator Mode</h2>
            <p>{result?.finish ? 'Dokonči partii · omezuj krále' : 'Hraješ obě barvy · návrhy na úrovni ~1200'}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Calculator Mode"
          className={`switch ${enabled ? 'is-on' : ''}`}
          onClick={calc.toggle}
        >
          <span className="switch__knob" />
        </button>
      </div>

      <div className="calc__actions">
        {!enabled && (
          <button type="button" className="btn btn--small btn--primary" onClick={onAnalyze}>
            Analyzovat tuto pozici
          </button>
        )}
        <button type="button" className="btn btn--small" onClick={onSetup}>
          Nastavit pozici
        </button>
      </div>

      {enabled && (
        <div className="calc__body">
          {!calc.unavailableReason && (
            <p className={`calc__turn is-${calc.side}`}>
              <strong>{calc.side === 'w' ? 'Na tahu je bílý' : 'Na tahu je černý'}</strong>
              <span>Obě barvy hraješ ty.</span>
            </p>
          )}
          {calc.unavailableReason ? (
            <p className="calc__muted">{calc.unavailableReason}</p>
          ) : calc.engineLoading ? (
            <p className="calc__muted">Čekám, až se načte engine…</p>
          ) : calc.waiting ? (
            <p className="calc__muted">Varianty spočítám, až bude tah na šachovnici.</p>
          ) : calc.loading ? (
            <p className="calc__muted calc__loading">
              <span className="spinner" /> Počítám varianty…
            </p>
          ) : !result ? (
            <p className="calc__muted">Varianty se nepodařilo spočítat.</p>
          ) : (
            <>
              {result.finish && (
                <p className="calc__finish">
                  <strong>{result.finish.title}</strong>
                  <span>
                    {result.finish.mateIn
                      ? `Vynucený ${mateInText(result.finish.mateIn)} – začni matovou cestou.`
                      : 'Máš jasnou výhru. Omezuj krále, nespěchej s materiálem.'}
                  </span>
                </p>
              )}
              <p className="calc__note">{result.note}</p>
              <ul className="calc__options">
                {result.options.map((option, i) => {
                  const selected = preview?.index === i
                  return (
                    <li
                      key={option.uci}
                      className={`calc-option ${selected ? 'is-selected' : ''} ${option.kind === 'mate' ? 'is-mate' : ''}`}
                      style={{ '--option-color': optionColor(option) } as CSSProperties}
                      data-uci={option.uci}
                      data-kind={option.kind}
                    >
                      <span className="calc-option__head">
                        <span className="calc-option__letter">{option.letter}</span>
                        <span className="calc-option__label">{option.label.replace(/^Tah [ABC] – /, '')}</span>
                      </span>
                      <span className="calc-option__move">{option.san}</span>
                      <span className="calc-option__text">{option.explanation}</span>
                      <span className="calc-option__branch">{branchText(option)}</span>
                      <span className="calc-option__actions">
                        <button type="button" className="calc-option__play" onClick={() => calc.playOption(i)}>
                          Zahrát
                        </button>
                        <button
                          type="button"
                          className="calc-option__preview"
                          aria-pressed={selected}
                          onClick={() => (selected ? calc.closePreview() : calc.openPreview(i))}
                        >
                          {selected ? 'Zavřít náhled' : 'Náhled'}
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
              {!preview && (
                <p className="calc__muted calc__tip">Zahrát tah rovnou položí na šachovnici. Náhled ho jen ukáže.</p>
              )}
            </>
          )}

          {preview && (
            <div className="calc-preview" style={{ '--option-color': optionColor(preview.option) } as CSSProperties}>
              <div className="calc-preview__head">
                <span>
                  Náhled: <strong>{preview.option.label}</strong>
                </span>
                <button type="button" className="calc-preview__close" onClick={calc.closePreview} aria-label="Zavřít náhled">
                  <CloseIcon width={16} height={16} />
                </button>
              </div>
              <ol className="calc-preview__line">
                {preview.option.previewSan.map((san, i) => {
                  const whitePly = (preview.option.mover === 'w') === (i % 2 === 0)
                  return (
                    <li key={i} className={i < preview.step ? (i === preview.step - 1 ? 'is-current' : 'is-played') : ''}>
                      {whitePly ? 'bílý' : 'černý'} {san}
                    </li>
                  )
                })}
              </ol>
              <div className="calc-preview__nav">
                <button type="button" className="btn btn--small" onClick={() => calc.stepPreview(-1)} disabled={preview.step === 0}>
                  <ArrowLeftIcon width={16} height={16} /> Předchozí tah
                </button>
                <span>
                  {preview.step}/{preview.total}
                </span>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => calc.stepPreview(1)}
                  disabled={preview.step >= preview.total}
                >
                  Další tah <ArrowRightIcon width={16} height={16} />
                </button>
                <button type="button" className="btn btn--small btn--primary" onClick={() => calc.playOption(preview.index)}>
                  Zahrát {preview.option.san}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
