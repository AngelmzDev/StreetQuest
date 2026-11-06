import { describe, expect, it, vi } from 'vitest'
import boundaryFixture from '../../test/fixtures/colmenarejo-boundary.json'
import streetsFixture from '../../test/fixtures/colmenarejo-streets.json'
import { mapEngineError, type MunicipalityCandidate, type MunicipalityPackage } from '../../domain/maps/types'
import type { MunicipalityStore } from '../../infrastructure/storage/municipalityStore'
import { createMunicipalityImporter } from './importMunicipality'

function candidate(overrides: Partial<MunicipalityCandidate> = {}): MunicipalityCandidate {
  return {
    osmType: 'relation', osmId: 347003, displayName: 'Colmenarejo, Madrid, España', municipalityName: 'Colmenarejo',
    province: 'Madrid', region: 'Comunidad de Madrid', country: 'España', countryCode: 'es', adminLevel: 8,
    bbox: [-4.0548953, 40.4856667, -3.9844494, 40.5841665], confidence: 190, confidenceReason: 'fixture', ...overrides,
  }
}

function boundaryFor(id: number) {
  const copy = structuredClone(boundaryFixture)
  copy.elements[0]!.id = id
  return copy
}

function memoryStore() {
  const packages = new Map<string, MunicipalityPackage>()
  const store: MunicipalityStore = {
    list: vi.fn(async () => []),
    get: vi.fn(async (id) => packages.get(id)),
    replaceAtomically: vi.fn(async (pkg) => { packages.set(pkg.id, pkg) }),
    replaceAndRemoveAtomically: vi.fn(async (pkg, supersededId) => { packages.set(pkg.id, pkg); packages.delete(supersededId) }),
    remove: vi.fn(async (id) => { packages.delete(id) }),
  }
  return { store, packages }
}

function importer(overrides: Record<string, unknown> = {}) {
  const { store, packages } = memoryStore()
  const nominatim = { searchMunicipalities: vi.fn(async () => [candidate()]) }
  const overpass = { executeOverpass: vi.fn(async (query: string) => query.includes('out geom') ? boundaryFixture : streetsFixture) }
  return {
    api: createMunicipalityImporter({
      nominatim, overpass, store, now: () => new Date('2026-11-06T10:00:00.000Z'),
      delay: async () => undefined, overpassEndpoint: 'https://overpass.test', ...overrides,
    }),
    nominatim, overpass, store, packages,
  }
}

describe('discoverMunicipalities', () => {
  it('returns none when discovery has no candidates', async () => {
    const { api } = importer({ nominatim: { searchMunicipalities: vi.fn(async () => []) } })
    await expect(api.discoverMunicipalities({ query: 'Nada', signal: new AbortController().signal })).resolves.toEqual({ kind: 'none' })
  })

  it('selects one clearly ranked municipality automatically', async () => {
    const { api } = importer()
    const result = await api.discoverMunicipalities({ query: 'Colmenarejo', province: 'Madrid', signal: new AbortController().signal })
    expect(result).toMatchObject({ kind: 'selected', candidate: { osmId: 347003 } })
  })

  it('returns tied candidates for explicit selection', async () => {
    const tied = [candidate({ osmId: 1, displayName: 'A' }), candidate({ osmId: 2, displayName: 'B' })]
    const { api } = importer({ nominatim: { searchMunicipalities: vi.fn(async () => tied) } })
    const result = await api.discoverMunicipalities({ query: 'Colmenarejo', signal: new AbortController().signal })
    expect(result).toMatchObject({ kind: 'selection-required', candidates: [{ osmId: 1 }, { osmId: 2 }] })
  })

  it('requires explicit selection for a weak single candidate', async () => {
    const weak = candidate({ municipalityName: 'Colmenarejo de Arriba', adminLevel: 9 })
    const { api } = importer({ nominatim: { searchMunicipalities: vi.fn(async () => [weak]) } })
    await expect(api.discoverMunicipalities({ query: 'Colmenarejo', signal: new AbortController().signal }))
      .resolves.toMatchObject({ kind: 'selection-required', candidates: [{ osmId: weak.osmId }] })
  })
})

describe('importMunicipality', () => {
  it('reports phases and uses the validated boundary bbox rather than a lagging derived area', async () => {
    const overpass = { executeOverpass: vi.fn()
      .mockResolvedValueOnce(boundaryFixture)
      .mockResolvedValueOnce(streetsFixture) }
    const { api, store } = importer({ overpass })
    const phases: string[] = []

    const pkg = await api.importMunicipality(candidate(), { signal: new AbortController().signal, onProgress: (phase) => phases.push(phase) })

    expect(phases).toEqual(['discovering-boundary', 'downloading-geometry', 'processing-streets', 'saving-locally'])
    expect(overpass.executeOverpass).toHaveBeenCalledTimes(2)
    expect(String(overpass.executeOverpass.mock.calls[1]?.[0])).toContain('(40.4856667,-4.0548953,40.5841665,-3.9844494)')
    expect(pkg).toMatchObject({ schemaVersion: 1, id: 'relation-347003', streets: [{ normalizedName: 'calle madrid' }, { normalizedName: 'plaza de la constitución' }] })
    expect(store.replaceAtomically).toHaveBeenCalledOnce()
  })

  it('does not save an already cancelled import', async () => {
    const { api, store } = importer()
    const controller = new AbortController()
    controller.abort()

    await expect(api.importMunicipality(candidate(), { signal: controller.signal, onProgress: () => undefined }))
      .rejects.toMatchObject({ kind: 'aborted' })
    expect(store.replaceAtomically).not.toHaveBeenCalled()
  })

  it('does not commit when cancellation occurs as saving begins', async () => {
    const { api, store } = importer()
    const controller = new AbortController()
    await expect(api.importMunicipality(candidate(), {
      signal: controller.signal,
      onProgress: (phase) => { if (phase === 'saving-locally') controller.abort() },
    })).rejects.toMatchObject({ kind: 'aborted' })
    expect(store.replaceAtomically).not.toHaveBeenCalled()
  })

  it('rejects nested relation coordinates before parsing an oversized boundary', async () => {
    const oversized = structuredClone(boundaryFixture) as typeof boundaryFixture
    oversized.elements[0]!.members[0]!.geometry = new Array(2_000_001)
    const overpass = { executeOverpass: vi.fn().mockResolvedValue(oversized) }
    const { api, store } = importer({ overpass })

    await expect(api.importMunicipality(candidate(), { signal: new AbortController().signal, onProgress: () => undefined }))
      .rejects.toMatchObject({ kind: 'limit-exceeded' })
    expect(store.replaceAtomically).not.toHaveBeenCalled()
  })

  it('retries a transient transport failure at most once', async () => {
    const overpass = { executeOverpass: vi.fn()
      .mockRejectedValueOnce(mapEngineError('network', 'transient', true))
      .mockResolvedValueOnce(boundaryFixture)
      .mockResolvedValueOnce(streetsFixture) }
    const { api } = importer({ overpass })

    await api.importMunicipality(candidate(), { signal: new AbortController().signal, onProgress: () => undefined })
    expect(overpass.executeOverpass).toHaveBeenCalledTimes(3)
  })

  it.each([
    mapEngineError('rate-limited', 'slow', false),
    mapEngineError('invalid-boundary', 'bad geometry', false),
  ])('does not retry non-retryable failures', async (failure) => {
    const overpass = { executeOverpass: vi.fn().mockRejectedValue(failure) }
    const { api, store } = importer({ overpass })

    await expect(api.importMunicipality(candidate(), { signal: new AbortController().signal, onProgress: () => undefined })).rejects.toBe(failure)
    expect(overpass.executeOverpass).toHaveBeenCalledOnce()
    expect(store.replaceAtomically).not.toHaveBeenCalled()
  })
})

describe('refreshMunicipality', () => {
  it('reuses the cached relation and preserves the prior cache on failure', async () => {
    const existing = await importer().api.importMunicipality(candidate(), { signal: new AbortController().signal, onProgress: () => undefined })
    const overpass = { executeOverpass: vi.fn().mockRejectedValue(mapEngineError('network', 'offline', false)) }
    const { api, store } = importer({ overpass })

    await expect(api.refreshMunicipality(existing, { signal: new AbortController().signal, onProgress: () => undefined })).rejects.toMatchObject({ kind: 'network' })
    expect(String(overpass.executeOverpass.mock.calls[0]?.[0])).toContain('relation(347003)')
    expect(store.replaceAtomically).not.toHaveBeenCalled()
  })

  it('rediscovers when the cached relation disappeared', async () => {
    const existing = await importer().api.importMunicipality(candidate(), { signal: new AbortController().signal, onProgress: () => undefined })
    const replacement = candidate({ osmId: 999 })
    const nominatim = { searchMunicipalities: vi.fn(async () => [replacement]) }
    const overpass = { executeOverpass: vi.fn()
      .mockResolvedValueOnce({ elements: [] })
      .mockResolvedValueOnce(boundaryFor(999))
      .mockResolvedValueOnce(streetsFixture) }
    const { api, store } = importer({ nominatim, overpass })

    const refreshed = await api.refreshMunicipality(existing, { signal: new AbortController().signal, onProgress: () => undefined })

    expect(nominatim.searchMunicipalities).toHaveBeenCalledOnce()
    expect(refreshed.id).toBe('relation-999')
    expect(store.replaceAndRemoveAtomically).toHaveBeenCalledWith(expect.objectContaining({ id: 'relation-999' }), existing.id)
  })

  it('requests explicit selection when rediscovery is ambiguous', async () => {
    const existing = await importer().api.importMunicipality(candidate(), { signal: new AbortController().signal, onProgress: () => undefined })
    const tied = [candidate({ osmId: 998, displayName: 'A' }), candidate({ osmId: 999, displayName: 'B' })]
    const nominatim = { searchMunicipalities: vi.fn(async () => tied) }
    const overpass = { executeOverpass: vi.fn().mockResolvedValueOnce({ elements: [] }) }
    const { api } = importer({ nominatim, overpass })

    await expect(api.refreshMunicipality(existing, { signal: new AbortController().signal, onProgress: () => undefined }))
      .rejects.toMatchObject({ kind: 'selection-required', cause: { candidates: expect.any(Array), supersedesId: existing.id } })
  })
})
