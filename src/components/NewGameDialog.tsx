import { useEffect, useState } from 'react'
import { DIFFICULTIES, type Difficulty } from '../game/difficulty'
import { loadPersonalMaterial, type PersonalMaterial } from '../game/personalTurn'
import type { GameMode, GameSettings, OpponentKind } from '../game/types'
import { PERSONAL_MODE_LABEL, resolveMode, type ResolvedMode } from '../personal/modes'
import { PERSONAL_STRENGTHS } from '../personal/strength'
import type { PersonalMode, PersonalStrengthId } from '../personal/types'
import { OPENINGS } from '../openings/openings'
import { Modal } from './Modal'
import './NewGameDialog.css'

const PERSONAL_MODES: PersonalMode[] = ['today', 'month-ago', 'trained']
const STRENGTHS: PersonalStrengthId[] = ['soft', 'match', 'sharp']

interface Props {
  initial: GameSettings
  onStart: (settings: GameSettings) => void
  onClose: () => void
}

export function NewGameDialog({ initial, onStart, onClose }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty)
  const [mode, setMode] = useState<GameMode>(initial.mode)
  const [openingId, setOpeningId] = useState(initial.openingId ?? OPENINGS[0].id)
  const [opponent, setOpponent] = useState<OpponentKind>(initial.opponent === 'personal' ? 'personal' : 'engine')
  const [personalMode, setPersonalMode] = useState<PersonalMode>(initial.personalMode ?? 'today')
  const [personalStrength, setPersonalStrength] = useState<PersonalStrengthId>(initial.personalStrength ?? 'match')
  const [material, setMaterial] = useState<PersonalMaterial | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const life = { cancelled: false }
    void loadPersonalMaterial()
      .then((next) => {
        if (!life.cancelled) setMaterial(next)
      })
      .catch(() => {
        if (!life.cancelled) setFailed(true)
      })
    return () => {
      life.cancelled = true
    }
  }, [])

  const chosen = availability(personalMode, material, failed)
  const personalOk = opponent !== 'personal' || chosen.available

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
            disabled={!personalOk}
            onClick={() =>
              onStart({
                difficulty,
                mode: opponent === 'personal' ? 'free' : mode,
                openingId: mode === 'opening' && opponent !== 'personal' ? openingId : null,
                puzzleId: mode === 'mate' && opponent !== 'personal' ? initial.puzzleId : null,
                opponent: opponent === 'personal' ? 'personal' : 'engine',
                personalMode,
                personalStrength,
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
            <label key={level.id} className={`option ${opponent === 'engine' && difficulty === level.id ? 'is-active' : ''}`}>
              <input
                type="radio"
                name="opponent"
                value={level.id}
                checked={opponent === 'engine' && difficulty === level.id}
                onChange={() => {
                  setDifficulty(level.id)
                  setOpponent('engine')
                }}
              />
              <span className="option__title">{level.label}</span>
              <span className="option__text">{level.description}</span>
            </label>
          ))}
        </div>
        <label className={`option option--personal ${opponent === 'personal' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name="opponent"
            checked={opponent === 'personal'}
            onChange={() => {
              setOpponent('personal')
              setMode('free')
            }}
          />
          <span className="option__title">Já</span>
          <span className="option__text">Soupeř hraje podle tvého stylu. Jen volná hra, vedle tří obtížností Stockfishe.</span>
        </label>
      </fieldset>

      {opponent === 'personal' && (
        <fieldset className="setup__group">
          <legend>Které já</legend>
          <div className="setup__options setup__options--3">
            {PERSONAL_MODES.map((id) => {
              const state = availability(id, material, failed)
              return (
                <label key={id} className={`option ${personalMode === id ? 'is-active' : ''}`}>
                  <input
                    type="radio"
                    name="personal-mode"
                    checked={personalMode === id}
                    disabled={!state.available}
                    onChange={() => setPersonalMode(id)}
                  />
                  <span className="option__title">{PERSONAL_MODE_LABEL[id]}</span>
                  <span className="option__text">{state.unavailableReason ?? state.notice ?? 'Podle uloženého profilu.'}</span>
                </label>
              )
            })}
          </div>
          <div className="setup__options setup__options--3">
            {STRENGTHS.map((id) => (
              <label key={id} className={`option ${personalStrength === id ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="personal-strength"
                  checked={personalStrength === id}
                  onChange={() => setPersonalStrength(id)}
                />
                <span className="option__title">{PERSONAL_STRENGTHS[id].label}</span>
                <span className="option__text">Skill {PERSONAL_STRENGTHS[id].skill}, MultiPV {PERSONAL_STRENGTHS[id].multipv}. Rozbor zůstává naplno.</span>
              </label>
            ))}
          </div>
          {chosen.notice && <p className="setup__note">{chosen.notice}</p>}
          {!personalOk && chosen.unavailableReason && <p className="setup__note">{chosen.unavailableReason}</p>}
        </fieldset>
      )}

      <fieldset className="setup__group">
        <legend>Režim</legend>
        <div className="setup__options setup__options--3">
          <label className={`option ${mode === 'free' ? 'is-active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'free'} onChange={() => setMode('free')} />
            <span className="option__title">Volná hra</span>
            <span className="option__text">Hraješ celou partii proti počítači a trenér komentuje každý tah.</span>
          </label>
          <label className={`option ${mode === 'opening' ? 'is-active' : ''}`}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'opening'}
              onChange={() => {
                setMode('opening')
                setOpponent('engine')
              }}
            />
            <span className="option__title">Trénink zahájení</span>
            <span className="option__text">Naučíš se hlavní variantu vybraného zahájení tah po tahu.</span>
          </label>
          <label className={`option ${mode === 'mate' ? 'is-active' : ''}`}>
            <input
              type="radio"
              name="mode"
              checked={mode === 'mate'}
              onChange={() => {
                setMode('mate')
                setOpponent('engine')
              }}
            />
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

function availability(mode: PersonalMode, material: PersonalMaterial | null, failed: boolean): ResolvedMode {
  if (failed) {
    if (mode === 'today') {
      return {
        available: true,
        unavailableReason: null,
        profile: null,
        weakModel: true,
        notice: 'Styl se nepodařilo načíst. Soupeř to řekne a použije obecný model.',
      }
    }
    return {
      available: false,
      unavailableReason: 'Snímky se nepodařilo načíst, takže tenhle režim nejde vybrat.',
      profile: null,
      weakModel: true,
      notice: null,
    }
  }
  if (!material) {
    if (mode === 'today') {
      return { available: true, unavailableReason: null, profile: null, weakModel: true, notice: 'Načítám styl…' }
    }
    return { available: false, unavailableReason: 'Načítám snímky…', profile: null, weakModel: true, notice: null }
  }
  return resolveMode({ mode, now: Date.now(), profile: material.profile, snapshots: material.snapshots })
}
