import { useState } from 'react'
import { DIFFICULTIES, type Difficulty } from '../game/difficulty'
import type { GameMode, GameSettings } from '../game/types'
import { OPENINGS } from '../openings/openings'
import { Modal } from './Modal'
import './NewGameDialog.css'

interface Props {
  initial: GameSettings
  onStart: (settings: GameSettings) => void
  onClose: () => void
}

export function NewGameDialog({ initial, onStart, onClose }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty)
  const [mode, setMode] = useState<GameMode>(initial.mode)
  const [openingId, setOpeningId] = useState(initial.openingId ?? OPENINGS[0].id)

  return (
    <Modal
      title="Nová hra"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Zrušit
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() =>
              onStart({
                difficulty,
                mode,
                openingId: mode === 'opening' ? openingId : null,
                puzzleId: mode === 'mate' ? initial.puzzleId : null,
              })
            }
          >
            Začít hru
          </button>
        </>
      }
    >
      <fieldset className="setup__group">
        <legend>Obtížnost</legend>
        <div className="setup__options setup__options--3">
          {Object.values(DIFFICULTIES).map((level) => (
            <label key={level.id} className={`option ${difficulty === level.id ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="difficulty"
                value={level.id}
                checked={difficulty === level.id}
                onChange={() => setDifficulty(level.id)}
              />
              <span className="option__title">{level.label}</span>
              <span className="option__text">{level.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="setup__group">
        <legend>Režim</legend>
        <div className="setup__options setup__options--3">
          <label className={`option ${mode === 'free' ? 'is-active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'free'} onChange={() => setMode('free')} />
            <span className="option__title">Volná hra</span>
            <span className="option__text">Hraješ celou partii proti počítači a trenér komentuje každý tah.</span>
          </label>
          <label className={`option ${mode === 'opening' ? 'is-active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'opening'} onChange={() => setMode('opening')} />
            <span className="option__title">Trénink zahájení</span>
            <span className="option__text">Naučíš se hlavní variantu vybraného zahájení tah po tahu.</span>
          </label>
          <label className={`option ${mode === 'mate' ? 'is-active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'mate'} onChange={() => setMode('mate')} />
            <span className="option__title">Trénink matů</span>
            <span className="option__text">Vyhrané pozice s vynuceným matem ve 2–4 tazích. Obtížnost tu nehraje roli.</span>
          </label>
        </div>
      </fieldset>

      {mode === 'opening' && (
        <fieldset className="setup__group">
          <legend>Zahájení</legend>
          <div className="openings">
            {OPENINGS.map((opening) => (
              <label key={opening.id} className={`option option--opening ${openingId === opening.id ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="opening"
                  checked={openingId === opening.id}
                  onChange={() => setOpeningId(opening.id)}
                />
                <span className="option__title">
                  {opening.name}
                  <span className="option__meta">
                    {opening.eco} · {opening.level}
                  </span>
                </span>
                <span className="option__text">{opening.summary}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </Modal>
  )
}
