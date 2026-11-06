import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import type { CachedMunicipalitySummary, ImportPhase, MapEngineError, MunicipalityCandidate } from '../../domain/maps/types'
import type { MunicipalityStore } from '../../infrastructure/storage/municipalityStore'
import type { MunicipalityImporter } from './importMunicipality'
import { useOnlineStatus } from './useOnlineStatus'

export interface AppServices {
  store: MunicipalityStore
  importer: MunicipalityImporter
}

interface MunicipalityHomeProps {
  services: AppServices
  onOpenMunicipality(id: string): void
}

interface HomeState {
  summaries: CachedMunicipalitySummary[]
  candidates: MunicipalityCandidate[]
  status: string
  error: string
  active: boolean
}

type HomeAction =
  | { type: 'catalog'; summaries: CachedMunicipalitySummary[] }
  | { type: 'candidates'; candidates: MunicipalityCandidate[] }
  | { type: 'status'; status: string }
  | { type: 'error'; error: string }
  | { type: 'clear-feedback' }
  | { type: 'active'; active: boolean }

const initialState: HomeState = { summaries: [], candidates: [], status: '', error: '', active: false }

function reducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case 'catalog': return { ...state, summaries: action.summaries }
    case 'candidates': return { ...state, candidates: action.candidates, status: '', error: '' }
    case 'status': return { ...state, status: action.status, error: '' }
    case 'error': return { ...state, error: action.error, status: '' }
    case 'clear-feedback': return { ...state, status: '', error: '', candidates: [] }
    case 'active': return { ...state, active: action.active }
  }
}

const PHASE_LABELS: Record<ImportPhase, string> = {
  'discovering-boundary': 'Comprobando el límite municipal…',
  'downloading-geometry': 'Descargando geometría vectorial…',
  'processing-streets': 'Procesando calles…',
  'saving-locally': 'Guardando para usar sin conexión…',
}

function friendlyError(error: unknown): string {
  const kind = typeof error === 'object' && error !== null && 'kind' in error ? (error as MapEngineError).kind : undefined
  switch (kind) {
    case 'aborted': return 'Operación cancelada.'
    case 'storage-quota': return 'No queda espacio local. Libera espacio del navegador y vuelve a intentarlo.'
    case 'rate-limited': return 'El servidor de mapas está ocupado. Espera unos minutos antes de reintentar.'
    case 'invalid-boundary': return 'No se pudo validar el límite municipal seleccionado.'
    case 'timeout': return 'El servidor tardó demasiado. Inténtalo de nuevo dentro de unos minutos.'
    case 'limit-exceeded': return 'El municipio es demasiado grande para los límites de seguridad actuales.'
    case 'invalid-response': return 'El servidor devolvió datos no válidos o incompletos. La copia local sigue intacta.'
    case 'storage': return 'No se pudo acceder al almacenamiento local. Revisa los permisos del navegador.'
    case 'offline': return 'No hay conexión. Puedes seguir usando los municipios guardados.'
    default: return 'No se pudo conectar o completar la operación. La copia guardada no se ha modificado.'
  }
}

export function MunicipalityHome({ services, onOpenMunicipality }: MunicipalityHomeProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [query, setQuery] = useState('Colmenarejo')
  const online = useOnlineStatus()
  const controller = useRef<AbortController | null>(null)
  const pendingSupersedesId = useRef<string | undefined>(undefined)
  const busy = state.active

  const reloadCatalog = useCallback(async () => {
    try {
      dispatch({ type: 'catalog', summaries: await services.store.list() })
    } catch (error) {
      dispatch({ type: 'error', error: friendlyError(error) })
    }
  }, [services.store])

  useEffect(() => { void reloadCatalog() }, [reloadCatalog])

  const downloadCandidate = useCallback(async (candidate: MunicipalityCandidate, activeController = new AbortController()) => {
    controller.current = activeController
    dispatch({ type: 'active', active: true })
    dispatch({ type: 'candidates', candidates: [] })
    try {
      await services.importer.importMunicipality(candidate, {
        signal: activeController.signal,
        onProgress: (phase) => dispatch({ type: 'status', status: PHASE_LABELS[phase] }),
        supersedesId: pendingSupersedesId.current,
      })
      pendingSupersedesId.current = undefined
      await reloadCatalog()
      dispatch({ type: 'status', status: `${candidate.municipalityName} está disponible sin conexión.` })
    } catch (error) {
      dispatch({ type: 'error', error: friendlyError(error) })
    } finally {
      controller.current = null
      dispatch({ type: 'active', active: false })
    }
  }, [reloadCatalog, services.importer])

  async function search(event: FormEvent) {
    event.preventDefault()
    if (!online || busy || !query.trim()) return
    const activeController = new AbortController()
    controller.current = activeController
    pendingSupersedesId.current = undefined
    dispatch({ type: 'active', active: true })
    dispatch({ type: 'status', status: 'Buscando el municipio…' })
    try {
      const result = await services.importer.discoverMunicipalities({ query: query.trim(), signal: activeController.signal })
      if (result.kind === 'none') dispatch({ type: 'error', error: 'No encontramos un municipio con ese nombre.' })
      else if (result.kind === 'selection-required') dispatch({ type: 'candidates', candidates: result.candidates })
      else await downloadCandidate(result.candidate, activeController)
    } catch (error) {
      dispatch({ type: 'error', error: friendlyError(error) })
      controller.current = null
    } finally {
      if (controller.current === activeController) {
        controller.current = null
        dispatch({ type: 'active', active: false })
      }
    }
  }

  async function refresh(summary: CachedMunicipalitySummary) {
    if (!online || busy) return
    const activeController = new AbortController()
    controller.current = activeController
    dispatch({ type: 'active', active: true })
    dispatch({ type: 'status', status: `Actualizando ${summary.name}…` })
    try {
      const cached = await services.store.get(summary.id)
      if (!cached) { await reloadCatalog(); return }
      await services.importer.refreshMunicipality(cached, {
        signal: activeController.signal,
        onProgress: (phase) => dispatch({ type: 'status', status: PHASE_LABELS[phase] }),
      })
      await reloadCatalog()
      dispatch({ type: 'status', status: `${summary.name} se ha actualizado.` })
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'kind' in error && error.kind === 'selection-required' && 'cause' in error) {
        const cause = error.cause as { candidates?: MunicipalityCandidate[]; supersedesId?: string }
        if (cause.candidates && cause.supersedesId) {
          pendingSupersedesId.current = cause.supersedesId
          dispatch({ type: 'candidates', candidates: cause.candidates })
        } else dispatch({ type: 'error', error: friendlyError(error) })
      } else dispatch({ type: 'error', error: friendlyError(error) })
    } finally {
      controller.current = null
      dispatch({ type: 'active', active: false })
    }
  }

  async function remove(summary: CachedMunicipalitySummary) {
    if (!window.confirm(`¿Eliminar la copia local de ${summary.name}?`)) return
    try {
      await services.store.remove(summary.id)
      await reloadCatalog()
    } catch (error) {
      dispatch({ type: 'error', error: friendlyError(error) })
    }
  }

  return (
    <section className="municipality-home" aria-labelledby="municipality-home-title">
      <div className="section-heading">
        <p className="eyebrow">Motor municipal</p>
        <h2 id="municipality-home-title">Tus mapas sin conexión</h2>
        <p>Descarga calles y límites vectoriales; después no necesitarás teselas ni conexión.</p>
      </div>

      {!online && <p className="offline-note">Sin conexión: puedes abrir los municipios guardados.</p>}

      <form className="search-card" onSubmit={search}>
        <label htmlFor="municipality-query">Municipio</label>
        <div className="search-row">
          <input id="municipality-query" value={query} onChange={(event) => setQuery(event.target.value)} disabled={busy} />
          <button type="submit" disabled={!online || busy || !query.trim()}>Buscar municipio</button>
        </div>
      </form>

      <div className="feedback" aria-live="polite">
        {state.status && <p>{state.status}</p>}
        {state.error && <p className="error-message">{state.error}</p>}
        {busy && <button type="button" className="secondary" onClick={() => controller.current?.abort()}>Cancelar</button>}
      </div>

      {state.candidates.length > 0 && (
        <div role="dialog" aria-label="Elige el municipio" className="candidate-dialog">
          <h3>Elige el municipio correcto</h3>
          {state.candidates.map((candidate) => (
            <button key={candidate.osmId} type="button" className="candidate" onClick={() => void downloadCandidate(candidate)}>
              <strong>{candidate.displayName}</strong>
              <span>{candidate.confidenceReason}</span>
            </button>
          ))}
        </div>
      )}

      <div className="municipality-grid">
        {state.summaries.map((summary) => (
          <article key={summary.id} className="municipality-card">
            <p className="eyebrow">{summary.province ?? 'España'}</p>
            <h3>{summary.name}</h3>
            <p>{summary.streetCount.toLocaleString('es-ES')} calles · guardado {new Date(summary.fetchedAt).toLocaleDateString('es-ES')}</p>
            <div className="card-actions">
              <button type="button" onClick={() => onOpenMunicipality(summary.id)}>Abrir {summary.name}</button>
              <button type="button" className="secondary" disabled={!online || busy} onClick={() => void refresh(summary)}>Actualizar {summary.name}</button>
              <button type="button" className="text-button" onClick={() => void remove(summary)}>Eliminar {summary.name}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
