import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MunicipalityPackage } from '../domain/maps/types'
import type { MunicipalityImporter } from '../features/municipalities/importMunicipality'
import { createMunicipalityStore } from '../infrastructure/storage/municipalityStore'
import { registerOfflineShell } from './offline'
import { App } from './App'

vi.mock('../features/study-map/leafletAdapter', () => ({ createStudyMap: vi.fn(() => ({ destroy: vi.fn(), selectStreet: vi.fn() })) }))

function cachedColmenarejo(): MunicipalityPackage {
  return {
    schemaVersion: 1, id: 'relation-347003',
    municipality: { osmType: 'relation', osmId: 347003, displayName: 'Colmenarejo, Madrid, España', municipalityName: 'Colmenarejo', province: 'Madrid', country: 'España', countryCode: 'es', confidence: 190, confidenceReason: 'cached' },
    boundary: { osmType: 'relation', osmId: 347003, name: 'Colmenarejo', bbox: [-4.05, 40.48, -3.98, 40.58], geometry: { type: 'Polygon', coordinates: [[[-4.05, 40.48], [-3.98, 40.48], [-3.98, 40.58], [-4.05, 40.48]]] } },
    streets: [{ id: 'street-1', name: 'Calle Madrid', normalizedName: 'calle madrid', highwayTypes: ['residential'], segments: [{ id: '1:0', sourceWayId: 1, partIndex: 0, name: 'Calle Madrid', highway: 'residential', coordinates: [[-4.02, 40.52], [-4.01, 40.53]] }] }],
    source: { provider: 'OpenStreetMap', overpassEndpoint: 'https://overpass.test', fetchedAt: '2026-11-06T10:00:00.000Z', attribution: '© OpenStreetMap contributors' },
  }
}

const inertImporter = {
  discoverMunicipalities: vi.fn(), importMunicipality: vi.fn(), refreshMunicipality: vi.fn(),
} as unknown as MunicipalityImporter

describe('offline application composition', () => {
  it('opens a cached municipality offline without Nominatim, Overpass, or tile requests', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const store = createMunicipalityStore('streetquest-app-integration-cached')
    await store.replaceAtomically(cachedColmenarejo())
    expect(await store.get('relation-347003')).toBeDefined()
    const getSpy = vi.spyOn(store, 'get')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<App services={{ store, importer: inertImporter }} />)

    fireEvent.click(await screen.findByRole('button', { name: /abrir colmenarejo/i }))

    expect(getSpy).toHaveBeenCalledWith('relation-347003')
    expect(await screen.findByRole('heading', { name: 'Colmenarejo', level: 1 })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('explains that a first-time offline user must download while online', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    render(<App services={{ store: createMunicipalityStore('streetquest-app-integration-empty'), importer: inertImporter }} />)

    expect(await screen.findByText(/sin conexión.*guardados/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /buscar municipio/i })).toBeDisabled()
  })

  it('registers the generated service worker immediately', () => {
    const register = vi.fn()
    registerOfflineShell(register)
    expect(register).toHaveBeenCalledWith({ immediate: true })
  })
})
