import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mapEngineError, type CachedMunicipalitySummary, type MunicipalityCandidate, type MunicipalityPackage } from '../../domain/maps/types'
import type { MunicipalityStore } from '../../infrastructure/storage/municipalityStore'
import type { ImportOptions, MunicipalityImporter } from './importMunicipality'
import { MunicipalityHome, type AppServices } from './MunicipalityHome'

const summary: CachedMunicipalitySummary = { id: 'relation-347003', name: 'Colmenarejo', province: 'Madrid', streetCount: 42, fetchedAt: '2026-11-06T10:00:00.000Z' }
const candidate: MunicipalityCandidate = {
  osmType: 'relation', osmId: 347003, displayName: 'Colmenarejo, Madrid, España', municipalityName: 'Colmenarejo',
  province: 'Madrid', region: 'Comunidad de Madrid', country: 'España', countryCode: 'es', adminLevel: 8,
  confidence: 190, confidenceReason: 'exacta',
}

function services(options: { summaries?: CachedMunicipalitySummary[]; discovery?: unknown; importFailure?: unknown } = {}): AppServices {
  const store: MunicipalityStore = {
    list: vi.fn(async () => options.summaries ?? []),
    get: vi.fn(async () => ({ id: summary.id } as MunicipalityPackage)),
    replaceAtomically: vi.fn(async () => undefined),
    replaceAndRemoveAtomically: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  }
  const importer = {
    discoverMunicipalities: vi.fn(async () => options.discovery ?? { kind: 'selected', candidate }),
    importMunicipality: vi.fn(async (_candidate, importOptions) => {
      importOptions.onProgress('processing-streets')
      if (options.importFailure) throw options.importFailure
      return { id: summary.id } as MunicipalityPackage
    }),
    refreshMunicipality: vi.fn(async () => ({ id: summary.id } as MunicipalityPackage)),
  } as unknown as MunicipalityImporter
  return { store, importer }
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

describe('MunicipalityHome', () => {
  it('prefills Colmenarejo and searches only after explicit submission', async () => {
    setOnline(true)
    const appServices = services()
    render(<MunicipalityHome services={appServices} onOpenMunicipality={() => undefined} />)

    expect(screen.getByRole('textbox', { name: /municipio/i })).toHaveValue('Colmenarejo')
    expect(appServices.importer.discoverMunicipalities).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /buscar municipio/i }))
    await waitFor(() => expect(appServices.importer.discoverMunicipalities).toHaveBeenCalledOnce())
  })

  it('shows cached municipalities without network calls and opens them', async () => {
    setOnline(true)
    const appServices = services({ summaries: [summary] })
    const onOpen = vi.fn()
    render(<MunicipalityHome services={appServices} onOpenMunicipality={onOpen} />)

    const open = await screen.findByRole('button', { name: /abrir colmenarejo/i })
    fireEvent.click(open)
    expect(onOpen).toHaveBeenCalledWith(summary.id)
    expect(appServices.importer.discoverMunicipalities).not.toHaveBeenCalled()
  })

  it('disables online search offline while cached maps remain available', async () => {
    setOnline(false)
    render(<MunicipalityHome services={services({ summaries: [summary] })} onOpenMunicipality={() => undefined} />)

    expect(await screen.findByRole('button', { name: /abrir colmenarejo/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /buscar municipio/i })).toBeDisabled()
    expect(screen.getByText(/sin conexión.*guardados/i)).toBeInTheDocument()
  })

  it('asks the user to resolve ambiguity and renders external names as text', async () => {
    setOnline(true)
    const suspicious = { ...candidate, osmId: 2, displayName: '<img src=x onerror=alert(1)>', confidence: 190 }
    const appServices = services({ discovery: { kind: 'selection-required', candidates: [candidate, suspicious] } })
    const { container } = render(<MunicipalityHome services={appServices} onOpenMunicipality={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: /buscar municipio/i }))

    expect(await screen.findByRole('dialog', { name: /elige el municipio/i })).toBeInTheDocument()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('announces import progress and cancellation aborts the active request', async () => {
    setOnline(true)
    let activeSignal: AbortSignal | undefined
    const appServices = services()
    appServices.importer.importMunicipality = vi.fn((_candidate: MunicipalityCandidate, options: ImportOptions) => new Promise<MunicipalityPackage>((_resolve, reject) => {
      activeSignal = options.signal
      options.onProgress('processing-streets')
      options.signal.addEventListener('abort', () => reject(mapEngineError('aborted', 'cancelada')))
    }))
    render(<MunicipalityHome services={appServices} onOpenMunicipality={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: /buscar municipio/i }))
    expect(await screen.findByText(/procesando calles/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(activeSignal?.aborted).toBe(true)
  })

  it('re-enables search and removes Cancel after a successful import', async () => {
    setOnline(true)
    const appServices = services()
    render(<MunicipalityHome services={appServices} onOpenMunicipality={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /buscar municipio/i }))
    await screen.findByText(/disponible sin conexión/i)
    expect(screen.getByRole('button', { name: /buscar municipio/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument()
  })

  it('keeps a cached card visible when refresh fails', async () => {
    setOnline(true)
    const appServices = services({ summaries: [summary] })
    appServices.importer.refreshMunicipality = vi.fn(async () => { throw mapEngineError('network', 'sin red') })
    render(<MunicipalityHome services={appServices} onOpenMunicipality={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: /actualizar colmenarejo/i }))

    expect(await screen.findByText(/no se pudo conectar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /abrir colmenarejo/i })).toBeInTheDocument()
  })

  it('removes a municipality only after confirmation', async () => {
    setOnline(true)
    const appServices = services({ summaries: [summary] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MunicipalityHome services={appServices} onOpenMunicipality={() => undefined} />)

    fireEvent.click(await screen.findByRole('button', { name: /eliminar colmenarejo/i }))
    await waitFor(() => expect(appServices.store.remove).toHaveBeenCalledWith(summary.id))
  })

  it.each([
    [mapEngineError('storage-quota', 'full'), /libera espacio/i],
    [mapEngineError('rate-limited', 'slow'), /servidor.*ocupado/i],
    [mapEngineError('timeout', 'slow', true), /tardó demasiado/i],
    [mapEngineError('limit-exceeded', 'large'), /demasiado grande/i],
    [mapEngineError('invalid-response', 'bad'), /datos no válidos/i],
    [mapEngineError('storage', 'denied'), /almacenamiento local/i],
  ])('shows actionable guidance for typed failures', async (failure, expected) => {
    setOnline(true)
    const appServices = services({ importFailure: failure })
    render(<MunicipalityHome services={appServices} onOpenMunicipality={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: /buscar municipio/i }))
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })
})
