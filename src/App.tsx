import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { enableLearning } from './game/learning'
import { Chess } from 'chess.js'
import { useCalculator, type BoardArrow } from './calculator/useCalculator'
import { czSan } from './chess/utils'
import { CalculatorPanel } from './components/CalculatorPanel'
import { ChessBoardView } from './components/ChessBoardView'
import { Controls } from './components/Controls'
import { EvalMeter } from './components/EvalMeter'
import { LogoMark } from './chess/pieces'
import { AboutDialog } from './components/AboutDialog'
import { BOARD_LABELS, type BoardName } from './ui/appearance'
import { MoveHistory } from './components/MoveHistory'
import { GamesDialog } from './components/GamesDialog'
const DashboardScreen = lazy(() => import('./components/DashboardScreen').then((module) => ({ default: module.DashboardScreen })))
const StyleScreen = lazy(() => import('./components/StyleScreen').then((module) => ({ default: module.StyleScreen })))
const ReviewScreen = lazy(() => import('./components/ReviewScreen').then((module) => ({ default: module.ReviewScreen })))
import { TrainingScreen } from './components/TrainingScreen'
import { OpeningExplorer } from './components/OpeningExplorer'
import { OpeningPanel } from './components/OpeningPanel'
import { NewGameDialog } from './components/NewGameDialog'
import { PositionSetupDialog } from './components/PositionSetupDialog'
import { PlayerBar } from './components/PlayerBar'
import { PuzzlePanel } from './components/PuzzlePanel'
import { CoachPanel } from './components/CoachPanel'
import { SummaryDialog } from './components/SummaryDialog'
import { beginAnalysis } from './game/analysisBridge'
import { DEFAULT_ANALYSIS } from './analysis/types'
import { TutorPanel } from './components/TutorPanel'
import { opponentOf, playerColorOf, type GameSettings, type PlayerColor } from './game/types'
import { PERSONAL_MODE_LABEL } from './personal/modes'
import { useChessGame } from './game/useChessGame'
import { subscribeStorageWarning } from './storage/errors'
import { applyAppearance, hydrateAppearance, loadAppearance, persistAppearance, type Appearance } from './ui/appearance'
import type { GameSummary } from './tutor/summary'
import './App.css'

function ScreenFallback() {
  return (
    <div className="screen-fallback" aria-busy="true">
      <div className="skeleton skeleton--card" />
    </div>
  )
}

function readAnchor(): number | null {
  try {
    const rating = Number(localStorage.getItem('ai-chess-tutor:anchor'))
    return Number.isFinite(rating) && rating >= 400 ? rating : null
  } catch {
    return null
  }
}

export default function App() {
  const game = useChessGame()
  const calc = useCalculator(game)
  const preview = calc.preview
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')
  const [showNewGame, setShowNewGame] = useState(false)
  const [showGames, setShowGames] = useState(false)
  const [screen, setScreen] = useState<'play' | 'review' | 'style' | 'dashboard' | 'training' | 'openings'>('play')
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance)
  const [appearanceReady, setAppearanceReady] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [dismissedSummary, setDismissedSummary] = useState<GameSummary | null>(null)
  const [coachArrow, setCoachArrow] = useState<BoardArrow | null>(null)
  const [openingArrow, setOpeningArrow] = useState<BoardArrow | null>(null)

  const summary = game.gameOver?.summary ?? null
  const summaryOpen = !!summary && summary !== dismissedSummary

  const plyLabel = useCallback(
    (index: number) => {
      const ply = game.plies[index]
      if (!ply) return ''
      return `${Math.floor(index / 2) + 1}${ply.move.color === 'w' ? '.' : '…'} ${czSan(ply.move.san)}`
    },
    [game.plies],
  )

  useEffect(() => subscribeStorageWarning(setStorageWarning), [])
  useEffect(() => enableLearning(), [])

  useEffect(() => {
    const life = { cancelled: false }
    void hydrateAppearance().then((stored) => {
      if (life.cancelled) return
      if (stored) setAppearance(stored)
      setAppearanceReady(true)
    })
    return () => {
      life.cancelled = true
    }
  }, [])

  useEffect(() => {
    applyAppearance(appearance)
    if (appearanceReady) persistAppearance(appearance)
  }, [appearance, appearanceReady])

  const { stepPreview, closePreview } = calc
  useEffect(() => {
    if (!preview) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview()
      else if (event.key === 'ArrowRight') stepPreview(1)
      else if (event.key === 'ArrowLeft') stepPreview(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, stepPreview, closePreview])

  const startGame = (settings: GameSettings) => {
    setShowNewGame(false)
    setOrientation(playerColorOf(settings) === 'b' ? 'black' : 'white')
    game.newGame(settings)
  }

  const confirmPosition = (fen: string) => {
    if (!game.loadPosition(fen)) return
    calc.enable()
    setShowSetup(false)
    setOrientation(new Chess(fen).turn() === 'b' ? 'black' : 'white')
  }

  const analyzeHere = () => {
    game.openInCalculator()
    calc.enable()
  }

  const puzzleOver = !!game.puzzle && game.puzzleStatus !== 'playing'
  const selfPlay = game.selfPlay && !game.puzzle
  const statusText = selfPlay && !game.gameOver
    ? game.turn === 'w'
      ? game.inCheck
        ? 'Šach! Na tahu je bílý – hraješ ty'
        : 'Na tahu je bílý – hraješ ty'
      : game.inCheck
        ? 'Šach! Na tahu je černý – hraješ ty'
        : 'Na tahu je černý – hraješ ty'
    : puzzleOver
    ? game.puzzleStatus === 'solved'
      ? 'Úloha vyřešena'
      : 'Úloha nevyšla'
    : game.gameOver
      ? 'Konec partie'
      : game.judging
        ? 'Trenér hodnotí tah'
        : game.aiThinking
          ? 'Počítač přemýšlí'
          : game.turn === playerColorOf(game.settings)
            ? game.inCheck
              ? 'Šach! Jsi na tahu'
              : 'Jsi na tahu'
            : 'Na tahu je soupeř'

  const personalGame = opponentOf(game.settings) === 'personal' && !selfPlay && !game.puzzle
  const personalLabel = PERSONAL_MODE_LABEL[game.settings.personalMode ?? 'today']
  const modeLabel = game.puzzle
    ? 'Trénink matů'
    : game.activeOpening
      ? `Trénink: ${game.activeOpening.name}`
      : personalGame
        ? 'Hra proti sobě'
        : 'Volná hra'
  const opponentSubtitle = game.puzzle ? 'Stockfish · brání se naplno' : personalGame ? personalLabel : `Stockfish · ${game.config.label}`
  const puzzleMovesLeft = game.puzzle ? game.puzzle.mateIn - game.plies.filter((p) => p.byUser).length : 0
  const userColor = playerColorOf(game.settings)
  const playerName = (color: 'w' | 'b') => {
    if (selfPlay) return color === 'w' ? 'Bílý' : 'Černý'
    const userPlaysThisColor = userColor === 'b' ? color === 'b' : orientation === 'white' ? color === 'w' : color === 'b'
    if (userPlaysThisColor) return 'Ty'
    return personalGame ? personalLabel : 'Počítač'
  }
  const sideSubtitle = (color: 'w' | 'b') => {
    if (selfPlay) return 'hraješ obě barvy'
    if (userColor === 'b') return color === 'b' ? 'černé figury' : opponentSubtitle
    return orientation === 'white' ? (color === 'b' ? opponentSubtitle : 'bílé figury') : color === 'w' ? 'bílé figury' : opponentSubtitle
  }
  const sideStatus = (color: 'w' | 'b', place: 'top' | 'bottom') => {
    if (userColor !== 'b') {
      if (selfPlay) {
        const moving = game.turn === (orientation === 'white' ? (place === 'top' ? 'b' : 'w') : place === 'top' ? 'w' : 'b')
        if (!game.gameOver && moving) return statusText
        if (place === 'bottom' && game.gameOver) return statusText
        return undefined
      }
      if (orientation === 'white') {
        return place === 'top' ? (game.aiThinking ? 'Přemýšlí' : undefined) : !game.gameOver && game.turn === 'w' ? statusText : game.gameOver ? statusText : undefined
      }
      return place === 'top' ? (!game.gameOver && game.turn === 'w' ? statusText : undefined) : game.aiThinking ? 'Přemýšlí' : undefined
    }
    const mine = color === 'b'
    if (selfPlay) {
      if (!game.gameOver && game.turn === color) return statusText
      if (place === 'bottom' && game.gameOver) return statusText
      return undefined
    }
    if (mine) return (!game.gameOver && game.turn === color) || game.gameOver ? statusText : undefined
    return game.aiThinking ? 'Přemýšlí' : undefined
  }
  const sideThinking = (color: 'w' | 'b', place: 'top' | 'bottom') => {
    if (selfPlay) return false
    if (userColor === 'b') return color === 'w' && game.aiThinking
    return (place === 'top' ? orientation === 'white' : orientation === 'black') && game.aiThinking
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand__logo">
            <LogoMark />
          </div>
          <div>
            <h1>AI Chess Tutor</h1>
            <p>Šachový trenér, který vysvětluje</p>
          </div>
        </div>
        <nav className="nav" aria-label="Hlavní">
          <button type="button" aria-current={!game.puzzle && screen === 'play' ? 'page' : undefined} onClick={() => { setScreen('play'); if (game.puzzle) game.exitPuzzles() }}>
            Hrát
          </button>
          <button type="button" aria-current={showGames ? 'page' : undefined} onClick={() => setShowGames(true)}>
            Moje partie
          </button>
          <button
            type="button"
            aria-current={screen === 'review' ? 'page' : undefined}
            onClick={() => setScreen('review')}
          >
            Rozbor
          </button>
          <button type="button" aria-current={screen === 'style' ? 'page' : undefined} onClick={() => setScreen('style')}>
            Můj styl
          </button>
          <button
            type="button"
            aria-current={screen === 'training' || game.puzzle ? 'page' : undefined}
            onClick={() => setScreen('training')}
          >
            Trénink
          </button>
          <button type="button" aria-current={screen === 'dashboard' ? 'page' : undefined} onClick={() => setScreen('dashboard')}>
            Dashboard
          </button>
          <button type="button" aria-current={screen === 'openings' ? 'page' : undefined} onClick={() => setScreen('openings')}>
            Zahájení
          </button>
        </nav>
      </header>
      <div className="topbar__tools">
        {summary && !summaryOpen && (
          <button type="button" className="btn btn--small" onClick={() => { setScreen('play'); setDismissedSummary(null) }}>
            Souhrn
          </button>
        )}
        {!game.puzzle && !selfPlay && <span className="pill">{personalGame ? personalLabel : game.config.label}</span>}
        <span className="pill pill--muted">{selfPlay ? 'Obě barvy' : modeLabel}</span>
        <button
          type="button"
          className="btn btn--small"
          aria-pressed={appearance.theme === 'light'}
          onClick={() => setAppearance((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }))}
        >
          {appearance.theme === 'dark' ? 'Světlý motiv' : 'Tmavý motiv'}
        </button>
        <button type="button" className="btn btn--small" onClick={() => setShowAbout(true)}>
          O aplikaci
        </button>
        <label className="board-pick">
          Šachovnice
          <select
            value={appearance.board}
            onChange={(event) => setAppearance((current) => ({ ...current, board: event.target.value as BoardName }))}
          >
            {(Object.keys(BOARD_LABELS) as BoardName[]).map((name) => (
              <option key={name} value={name}>
                {BOARD_LABELS[name]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {screen === 'review' ? (
        <div className="screen-scroll">
          <Suspense fallback={<ScreenFallback />}>
            <ReviewScreen board={appearance.board} />
          </Suspense>
        </div>
      ) : screen === 'dashboard' ? (
        <div className="screen-scroll">
          <Suspense fallback={<ScreenFallback />}>
            <DashboardScreen onImport={() => setShowGames(true)} onReview={() => setScreen('review')} />
          </Suspense>
        </div>
      ) : screen === 'style' ? (
        <div className="screen-scroll">
          <Suspense fallback={<ScreenFallback />}>
            <StyleScreen />
          </Suspense>
        </div>
      ) : screen === 'openings' ? (
        <div className="screen-scroll">
          <OpeningExplorer
            board={appearance.board}
            onTrain={(openingId, playerColor: PlayerColor) => {
              setOrientation(playerColor === 'b' ? 'black' : 'white')
              setScreen('play')
              game.newGame({ mode: 'opening', openingId, opponent: 'engine', playerColor })
            }}
          />
        </div>
      ) : screen === 'training' ? (
        <div className="screen-scroll">
        <TrainingScreen
          board={appearance.board}
          onMates={() => {
            setScreen('play')
            setOrientation('white')
            if (!game.puzzle) game.nextPuzzle()
          }}
        />
        </div>
      ) : (
      <main className="layout">
        <section className="play" aria-label="Šachovnice">
          {storageWarning && (
            <p className="storage-banner" role="alert">
              {storageWarning}
            </p>
          )}
          <div className="play__board">
            <PlayerBar
              name={playerName(orientation === 'white' ? 'b' : 'w')}
              subtitle={sideSubtitle(orientation === 'white' ? 'b' : 'w')}
              color={orientation === 'white' ? 'b' : 'w'}
              plies={game.plies}
              active={!game.gameOver && (orientation === 'white' ? game.turn === 'b' : game.turn === 'w')}
              status={sideStatus(orientation === 'white' ? 'b' : 'w', 'top')}
              thinking={sideThinking(orientation === 'white' ? 'b' : 'w', 'top')}
            />
            <div className="play__stage">
              <ChessBoardView
                board={appearance.board}
                fen={preview?.fen ?? game.fen}
                orientation={orientation}
                canMove={game.canMove && !preview}
                lastMove={preview ? preview.lastMove : game.lastMove}
                inCheck={preview ? preview.inCheck : game.inCheck}
                hint={preview ? null : game.hint}
                extraArrows={
                  preview
                    ? calc.arrows
                    : [...calc.arrows, ...(coachArrow ? [coachArrow] : []), ...(openingArrow ? [openingArrow] : [])]
                }
                onMove={game.makeMove}
              />
              {preview && (
                <div className="preview-banner" role="status">
                  <span>
                    Náhled varianty {preview.option.letter} – nehraje se ({preview.step}/{preview.total})
                  </span>
                  <button type="button" className="btn btn--small" onClick={closePreview}>
                    Zpět k partii
                  </button>
                </div>
              )}
            </div>
            <PlayerBar
              name={playerName(orientation === 'white' ? 'w' : 'b')}
              subtitle={sideSubtitle(orientation === 'white' ? 'w' : 'b')}
              color={orientation === 'white' ? 'w' : 'b'}
              plies={game.plies}
              active={!game.gameOver && (orientation === 'white' ? game.turn === 'w' : game.turn === 'b')}
              status={sideStatus(orientation === 'white' ? 'w' : 'b', 'bottom')}
              thinking={sideThinking(orientation === 'white' ? 'w' : 'b', 'bottom')}
            />
          </div>
          <Controls
            canUndo={game.plies.some((p) => p.byUser) && !game.aiThinking}
            canHint={game.canMove && game.engineStatus !== 'loading'}
            canResign={game.puzzle ? game.puzzleStatus === 'playing' && !game.gameOver : !game.gameOver && game.plies.length > 0}
            resignLabel={game.puzzle ? 'Řešení' : 'Vzdát'}
            onNewGame={() => setShowNewGame(true)}
            onUndo={game.undo}
            onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            onHint={game.requestHint}
            onResign={game.resign}
          />
        </section>

        <aside className="sidebar" aria-label="Trenér a analýza">
          {game.puzzle && (
            <PuzzlePanel
              puzzle={game.puzzle}
              status={game.puzzleStatus}
              solved={game.solvedPuzzles}
              movesLeft={puzzleMovesLeft}
              onSelect={(id) => {
                setOrientation('white')
                game.startPuzzle(id)
              }}
              onRetry={() => game.startPuzzle(game.puzzle!.id)}
              onNext={game.nextPuzzle}
              onExit={game.exitPuzzles}
            />
          )}
          {!game.puzzle && (
            <EvalMeter
              evaluation={game.evaluation}
              analysing={game.analysing}
              engineStatus={game.engineStatus}
              openingName={game.openingName}
              bothSides={selfPlay}
              userColor={userColor}
            />
          )}
          {!game.puzzle && game.settings.mode === 'free' && (
            <OpeningPanel
              fen={preview?.fen ?? game.fen}
              canPlay={!preview && game.canMove}
              onArrow={setOpeningArrow}
              onPlay={(move) => {
                setOpeningArrow(null)
                game.makeMove(move)
              }}
            />
          )}
          {!game.puzzle && <CalculatorPanel calc={calc} fen={game.fen} onSetup={() => setShowSetup(true)} onAnalyze={analyzeHere} />}
          {!game.puzzle && !game.gameOver && (
            <CoachPanel
              fen={preview?.fen ?? game.fen}
              elo={readAnchor()}
              onArrow={setCoachArrow}
              onPlay={(move) => {
                setCoachArrow(null)
                game.makeMove(move)
              }}
            />
          )}
          <TutorPanel messages={game.messages} plyLabel={plyLabel} />
          <MoveHistory plies={game.plies} comments={game.comments} onExplain={game.explainPly} />
        </aside>
      </main>
      )}

      {showGames && (
        <GamesDialog
          onClose={() => setShowGames(false)}
          onResume={game.resumeGame}
          onDelete={game.deleteSavedGame}
        />
      )}
      {showNewGame && (
        <NewGameDialog initial={game.settings} onStart={startGame} onClose={() => setShowNewGame(false)} />
      )}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      {showSetup && (
        <PositionSetupDialog initialFen={game.fen} board={appearance.board} onConfirm={confirmPosition} onClose={() => setShowSetup(false)} />
      )}
      {summaryOpen && summary && (
        <SummaryDialog
          summary={summary}
          gameId={game.savedGameId}
          onAnalyze={() => {
            const id = game.savedGameId
            if (!id) return
            setDismissedSummary(summary)
            setScreen('review')
            beginAnalysis(id, DEFAULT_ANALYSIS)
          }}
          onClose={() => setDismissedSummary(summary)}
          onNewGame={() => {
            setDismissedSummary(summary)
            setShowNewGame(true)
          }}
        />
      )}
    </div>
  )
}
