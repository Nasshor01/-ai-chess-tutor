import type { CSSProperties } from 'react'
import { branchText } from '../calculator/calculator'
import { OPTION_COLORS, type Calculator } from '../calculator/useCalculator'
import { ArrowLeftIcon, ArrowRightIcon, CalculatorIcon, CloseIcon } from './Icons'
import './CalculatorPanel.css'

interface Props {
  calc: Calculator
}

export function CalculatorPanel({ calc }: Props) {
  const { enabled, result, preview } = calc

  return (
    <section className={`card calc ${enabled ? 'is-on' : ''}`} aria-label="Calculator Mode">
      <div className="calc__header">
        <div className="calc__title">
          <CalculatorIcon width={18} height={18} />
          <div>
            <h2>Calculator Mode</h2>
            <p>Praktické varianty místo jediného „nejlepšího“ tahu</p>
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

      {enabled && (
        <div className="calc__body">
          {calc.unavailableReason ? (
            <p className="calc__muted">{calc.unavailableReason}</p>
          ) : calc.waiting ? (
            <p className="calc__muted">Varianty spočítám, až budeš na tahu.</p>
          ) : calc.loading ? (
            <p className="calc__muted calc__loading">
              <span className="spinner" /> Počítám varianty…
            </p>
          ) : !result ? (
            <p className="calc__muted">Varianty se nepodařilo spočítat.</p>
          ) : (
            <>
              <p className="calc__style" title={result.style.text}>
                <strong>{result.style.label}:</strong> {result.style.text}
              </p>
              {result.note && <p className="calc__note">{result.note}</p>}
              <ul className="calc__options">
                {result.options.map((option, i) => {
                  const selected = preview?.index === i
                  return (
                    <li key={option.uci}>
                      <button
                        type="button"
                        className={`calc-option ${selected ? 'is-selected' : ''}`}
                        style={{ '--option-color': OPTION_COLORS[option.letter] } as CSSProperties}
                        onClick={() => (selected ? calc.closePreview() : calc.openPreview(i))}
                        aria-pressed={selected}
                        data-uci={option.uci}
                      >
                        <span className="calc-option__head">
                          <span className="calc-option__letter">{option.letter}</span>
                          <span className="calc-option__label">{option.label.replace(/^Tah [ABC] – /, '')}</span>
                          {option.recommended && <span className="calc-option__badge">Pro tvůj styl</span>}
                          <span className="calc-option__score">{option.scoreText}</span>
                        </span>
                        <span className="calc-option__move">{option.san}</span>
                        <span className="calc-option__text">{option.explanation}</span>
                        <span className="calc-option__branch">{branchText(option)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!preview && <p className="calc__muted calc__tip">Klikni na variantu a uvidíš ji na šachovnici – nic se nezahraje.</p>}
            </>
          )}

          {preview && (
            <div className="calc-preview" style={{ '--option-color': OPTION_COLORS[preview.option.letter] } as CSSProperties}>
              <div className="calc-preview__head">
                <span>
                  Náhled: <strong>{preview.option.label}</strong>
                </span>
                <button type="button" className="calc-preview__close" onClick={calc.closePreview} aria-label="Zavřít náhled">
                  <CloseIcon width={16} height={16} />
                </button>
              </div>
              <ol className="calc-preview__line">
                {preview.option.previewSan.map((san, i) => (
                  <li key={i} className={i < preview.step ? (i === preview.step - 1 ? 'is-current' : 'is-played') : ''}>
                    {i % 2 === 0 ? 'ty' : 'soupeř'} {san}
                  </li>
                ))}
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
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
