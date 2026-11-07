import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { MunicipalityPackage } from '../../domain/maps/types'
import { createStudyMap } from './leafletAdapter'
import { answerGame, readStreakRecord, saveStreakRecord, startGame, type GameMode, type StreetGame } from './streetGame'
import { readProgress, recordAttempt, reviewStreets, summarizeProgress } from './learningProgress'
import { MapLayerControls } from './MapLayerControls'
import { CONTEXT_KINDS } from './mapTheme'
import { ProgressTransfer } from './ProgressTransfer'

export function StudyMap({ municipality, onBack }: { municipality: MunicipalityPackage; onBack(): void }) {
  const host = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof createStudyMap> | null>(null)
  const [selectedStreetId, setSelectedStreetId] = useState('')
  const [detailed, setDetailed] = useState(Boolean(municipality.context?.length))
  const [contextKinds, setContextKinds] = useState(CONTEXT_KINDS)
  const [game, setGame] = useState<StreetGame | null>(null)
  const [continuous, setContinuous] = useState(false)
  const [progressWarning, setProgressWarning] = useState(false)
  const [progressRevision, setProgressRevision] = useState(0)
  const answeredQuestion = useRef<StreetGame['questions'][number] | null>(null)
  const [transferBusy, setTransferBusy] = useState(false)
  const question = game?.questions[game.index]
  const locating = game?.mode === 'locate'
  const answered = game?.answered ?? false
  const highlighted = game
    ? (!locating || answered ? question?.street.id ?? '' : '')
    : selectedStreetId

  const onMapStreet = useEffectEvent((id: string) => {
    if (!game) setSelectedStreetId(id)
    else if (locating) submitAnswer(id)
  })

  useEffect(() => {
    if (!host.current) return
    controller.current = createStudyMap(host.current, municipality, undefined, onMapStreet, detailed ? contextKinds : [])
    return () => {
      controller.current?.destroy()
      controller.current = null
    }
  }, [municipality, detailed, contextKinds])

  useEffect(() => {
    controller.current?.selectStreet(highlighted)
  }, [municipality, highlighted, detailed, contextKinds])

  useEffect(() => {
    if (!question) return
    if (!locating || answered) controller.current?.focusStreet(question.street.id)
    else controller.current?.resetView()
  }, [question, locating, answered, detailed, contextKinds])

  function submitAnswer(id?: string) {
    if (!game || !question || game.answered || answeredQuestion.current === question) return
    answeredQuestion.current = question
    const updated = answerGame(game, id)
    const saved = recordAttempt(municipality.id, game.mode, question.street.id, updated.lastCorrect)
    const recordSaved = saveStreakRecord(municipality.id, game.mode, updated.record, game.continuous)
    setProgressWarning(!saved || !recordSaved)
    setGame(updated)
  }

  function begin(mode: GameMode, review = false) {
    if (transferBusy) return
    setSelectedStreetId('')
    answeredQuestion.current = null
    const queue = review ? reviewStreets(municipality.streets, readProgress(municipality.id, mode)) : undefined
    setGame(startGame(mode, municipality.streets, readStreakRecord(municipality.id, mode, continuous), queue, continuous))
  }

  function exitGame() {
    setGame(null)
    controller.current?.resetView()
  }

  const selectedStreet = municipality.streets.find((street) => street.id === selectedStreetId)
  const lastQuestion = game && (game.index + 1 === game.questions.length || (game.continuous && answered && !game.lastCorrect))

  return (
    <section className="study-view" aria-labelledby="study-map-title">
      <header className="study-header">
        <button type="button" className="secondary" onClick={onBack}>← Volver a municipios</button>
        <div>
          <p className="eyebrow">{game ? 'Juegos · sin etiquetas' : 'Modo estudio · sin etiquetas'}</p>
          <h1 id="study-map-title">{municipality.municipality.municipalityName}</h1>
        </div>
        {!game && <label className="street-picker">
          Seleccionar calle
          <select value={selectedStreetId} onChange={(event) => {
            setSelectedStreetId(event.target.value)
            if (event.target.value) controller.current?.focusStreet(event.target.value)
            else controller.current?.resetView()
          }}>
            <option value="">Ninguna</option>
            {municipality.streets.map((street) => <option key={street.id} value={street.id}>{street.name}</option>)}
          </select>
        </label>}
      </header>
      <section className="game-panel" aria-label="Juegos de calles">
        <MapLayerControls available={Boolean(municipality.context?.length)} detailed={detailed} kinds={contextKinds} onDetailed={setDetailed} onKinds={setContextKinds} />
        {progressWarning && <p role="alert">No se pudo guardar el progreso. Revisa el espacio y los permisos de almacenamiento.</p>}
        {!game && <div className="game-actions">
          <label><input type="checkbox" checked={continuous} onChange={(event) => setContinuous(event.target.checked)} /> Racha continua hasta fallar</label>
          <button type="button" onClick={() => begin('guess')} disabled={municipality.streets.length < 2}>Adivina la calle</button>
          <button type="button" onClick={() => begin('locate')} disabled={!municipality.streets.length}>Localiza la calle</button>
        </div>}
        {!game && <section aria-label="Repaso inteligente">
          <h2>Tu progreso</h2>
          <p>Tres aciertos seguidos en una calle la marcan como dominada. El repaso prioriza las que aún cuestan, después las nuevas y finalmente las dominadas.</p>
          <div className="game-actions">
            {(['guess', 'locate'] as const).map((reviewMode) => {
              const summary = summarizeProgress(municipality.streets, readProgress(municipality.id, reviewMode))
              return <div key={reviewMode}>
                <p><strong>{reviewMode === 'guess' ? 'Nombres' : 'Ubicaciones'}</strong> · {summary.studied} de {municipality.streets.length} practicadas · {summary.mastered} dominadas · {summary.correct}/{summary.attempts} aciertos</p>
                <button type="button" className="secondary" onClick={() => begin(reviewMode, true)} disabled={municipality.streets.length < (reviewMode === 'guess' ? 2 : 1)}>
                  {reviewMode === 'guess' ? 'Repasar nombres' : 'Repasar ubicaciones'}
                </button>
              </div>
            })}
          </div>
          <ProgressTransfer key={municipality.id} municipalityId={municipality.id} onBusy={setTransferBusy} onRestored={() => setProgressRevision((version) => version + 1)} />
          <span className="sr-only" aria-live="polite">{progressRevision > 0 ? 'Progreso actualizado' : ''}</span>
        </section>}
        {game && <div className="game-score" role="status" aria-label="Marcador">
          <span>Puntuación: {game.correct}</span>
          <span>Racha actual: {game.streak}</span>
          <span>Récord: {game.record}</span>
        </div>}
        {game && question && <>
          {game.review && <p>Repaso inteligente</p>}
          <p aria-live="polite">Pregunta {game.index + 1} de {game.questions.length} · {game.correct} aciertos</p>
          <strong>{locating ? `Localiza ${question.street.name} en el mapa.` : '¿Cómo se llama la calle resaltada?'}</strong>
          {answered && <p role="status">{game.lastCorrect ? '¡Correcto! ' : ''}La calle era {question.street.name}.</p>}
          <div className="game-actions">
            {!answered && question.options.map((option) => (
              <button className="secondary" type="button" key={option.id} onClick={() => submitAnswer(option.id)}>{option.name}</button>
            ))}
            {answered ? (
              <button type="button" onClick={() => setGame({ ...game, index: lastQuestion ? game.questions.length : game.index + 1, answered: false })}>
                {lastQuestion ? 'Ver resultado' : 'Siguiente calle'}
              </button>
            ) : <button className="secondary" type="button" onClick={() => submitAnswer()}>Saltar</button>}
            <button className="text-button" type="button" onClick={exitGame}>Salir del juego</button>
          </div>
        </>}
        {game && !question && <>
          <strong role="status">{game.correct} de {game.attempts} aciertos</strong>
          {game.mistakes.length > 0 && <>
            <p>Calles para repasar</p>
            <ul>{game.mistakes.map((street) => <li key={street.id}>{street.name}</li>)}</ul>
          </>}
          <div className="game-actions">
            <button type="button" onClick={() => begin(game.mode, game.review)}>Jugar otra vez</button>
            {game.mistakes.length > 0 && <button type="button" className="secondary" onClick={() => {
              answeredQuestion.current = null
              setGame(startGame(game.mode, municipality.streets, readStreakRecord(municipality.id, game.mode), game.mistakes))
            }}>Repasar errores</button>}
            <button className="secondary" type="button" onClick={exitGame}>Volver a explorar</button>
          </div>
        </>}
      </section>
      <div ref={host} data-map-host className="study-map" aria-label={`Mapa vectorial de ${municipality.municipality.municipalityName}`} />
      <footer className="study-footer">
        {!game && <strong>{selectedStreet?.name ?? 'Selecciona una calle para identificarla'}</strong>}
        <span>{municipality.source.attribution}</span>
      </footer>
    </section>
  )
}
