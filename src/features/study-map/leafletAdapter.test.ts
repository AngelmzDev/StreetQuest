import { describe, expect, it, vi } from 'vitest'
import type { MunicipalityPackage, StreetSegment } from '../../domain/maps/types'
import { createStudyMap, type LeafletFacade } from './leafletAdapter'

function packageFixture(segments: StreetSegment[] = [{
  id: '1:0', sourceWayId: 1, partIndex: 0, name: 'Calle Uno', highway: 'residential', coordinates: [[0, 0.5], [1, 0.5]],
}]): MunicipalityPackage {
  return {
    schemaVersion: 1, id: 'relation-1',
    municipality: { osmType: 'relation', osmId: 1, displayName: 'Villa', municipalityName: 'Villa', country: 'España', countryCode: 'es', confidence: 1, confidenceReason: 'test' },
    boundary: {
      osmType: 'relation', osmId: 1, name: 'Villa', bbox: [0, 0, 4, 4],
      geometry: { type: 'Polygon', coordinates: [
        [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
        [[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]],
      ] },
    },
    streets: [{ id: 'street-1', name: 'Calle Uno', normalizedName: 'calle uno', highwayTypes: ['residential'], segments }],
    source: { provider: 'OpenStreetMap', overpassEndpoint: 'test', fetchedAt: '2026-11-06T10:00:00.000Z', attribution: '© OpenStreetMap contributors' },
  }
}

function fakeLeaflet() {
  const fitBounds = vi.fn()
  const remove = vi.fn()
  const map = vi.fn(() => ({ fitBounds, remove }))
  const canvasRenderer = { kind: 'canvas' }
  const canvas = vi.fn(() => canvasRenderer)
  const layers: Array<{ feature?: { properties?: Record<string, unknown> }; setStyle: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> }> = []
  const geoJsonCalls: unknown[] = []
  const geoJSON = vi.fn((data: { features?: Array<{ properties?: Record<string, unknown> }>; properties?: Record<string, unknown> }, options?: { onEachFeature?: (feature: unknown, layer: unknown) => void }) => {
    geoJsonCalls.push(data)
    const features = Array.isArray(data.features) ? data.features : [{ properties: data.properties }]
    const localLayers = features.map((feature) => {
      const layer = { feature, setStyle: vi.fn(), on: vi.fn() }
      options?.onEachFeature?.(feature, layer)
      layers.push(layer)
      return layer
    })
    return { addTo: vi.fn().mockReturnThis(), eachLayer: (fn: (layer: unknown) => void) => localLayers.forEach(fn) }
  })
  return { facade: { map, canvas, geoJSON } as unknown as LeafletFacade, fitBounds, remove, map, canvas, layers, geoJsonCalls }
}

describe('createStudyMap', () => {
  it('renders selected context layers without names or clickable answers', () => {
    const fake = fakeLeaflet()
    const pkg = packageFixture()
    pkg.context = [
      { id: 'building', kind: 'building', geometry: pkg.boundary.geometry },
      { id: 'park', kind: 'green', geometry: pkg.boundary.geometry },
    ]
    createStudyMap(document.createElement('div'), pkg, fake.facade, undefined, ['building'])
    const context = fake.geoJsonCalls[1] as { features: Array<{ properties: unknown }> }
    expect(context.features).toHaveLength(1)
    expect(context.features[0]?.properties).toEqual({ kind: 'building' })
  })
  it('uses Canvas, fits the validated boundary, and never requests tiles', () => {
    const fake = fakeLeaflet()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const container = document.createElement('div')

    createStudyMap(container, packageFixture(), fake.facade)

    expect(fake.canvas).toHaveBeenCalledOnce()
    expect(fake.map).toHaveBeenCalledWith(container, expect.objectContaining({ renderer: { kind: 'canvas' } }))
    expect(fake.fitBounds).toHaveBeenCalledWith([[0, 0], [4, 4]], expect.any(Object))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('passes polygon outers, inners, and every street part to grouped GeoJSON layers', () => {
    const fake = fakeLeaflet()
    const parts = [
      { id: '1:0', sourceWayId: 1, partIndex: 0, name: 'Calle Uno', highway: 'residential', coordinates: [[0, 0.5], [1, 0.5]] },
      { id: '1:1', sourceWayId: 1, partIndex: 1, name: 'Calle Uno', highway: 'residential', coordinates: [[3, 0.5], [4, 0.5]] },
    ] as StreetSegment[]

    createStudyMap(document.createElement('div'), packageFixture(parts), fake.facade)

    const boundary = fake.geoJsonCalls[0] as { geometry: { coordinates: unknown[] } }
    const streets = fake.geoJsonCalls[1] as { features: unknown[] }
    expect(boundary.geometry.coordinates).toHaveLength(2)
    expect(streets.features).toHaveLength(2)
  })

  it('highlights one street deterministically and cleans up the Leaflet map', () => {
    const fake = fakeLeaflet()
    const controller = createStudyMap(document.createElement('div'), packageFixture(), fake.facade)

    controller.selectStreet('street-1')
    controller.destroy()

    expect(fake.layers.some((layer) => layer.setStyle.mock.calls.some(([style]) => style.weight === 6))).toBe(true)
    expect(fake.remove).toHaveBeenCalledOnce()
  })
})
