import { describe, expect, it } from 'vitest'
import colmenarejo from '../../test/fixtures/colmenarejo-boundary.json'
import enclave from '../../test/fixtures/multipolygon-enclave.json'
import streets from '../../test/fixtures/colmenarejo-streets.json'
import { parseMunicipalityBoundary, parseStreetWays } from './parsers'

describe('parseMunicipalityBoundary', () => {
  it('parses the condensed Colmenarejo relation and closes its outer ring', () => {
    const boundary = parseMunicipalityBoundary(colmenarejo, 347003)
    const rings = boundary.geometry.type === 'Polygon' ? boundary.geometry.coordinates : boundary.geometry.coordinates[0]!

    expect(boundary).toMatchObject({ osmId: 347003, name: 'Colmenarejo' })
    expect(rings[0]?.[0]).toEqual(rings[0]?.at(-1))
    expect(boundary.bbox).toEqual([-4.0548953, 40.4856667, -3.9844494, 40.5841665])
  })

  it('preserves disjoint outer rings and an inner enclave', () => {
    const boundary = parseMunicipalityBoundary(enclave, 800)

    expect(boundary.geometry.type).toBe('MultiPolygon')
    if (boundary.geometry.type === 'MultiPolygon') {
      expect(boundary.geometry.coordinates).toHaveLength(2)
      expect(boundary.geometry.coordinates.some((polygon) => polygon.length === 2)).toBe(true)
    }
  })

  it('rejects a payload without the requested relation', () => {
    expect(() => parseMunicipalityBoundary(colmenarejo, 999)).toThrowError(expect.objectContaining({ kind: 'not-found' }))
  })

  it('rejects a relation with no outer geometry', () => {
    const payload = { elements: [{ type: 'relation', id: 9, members: [{ type: 'way', ref: 1, role: 'inner', geometry: [] }], tags: { name: 'Rota' } }] }
    expect(() => parseMunicipalityBoundary(payload, 9)).toThrowError(expect.objectContaining({ kind: 'invalid-boundary' }))
  })

  it('rejects a relation when any required inner member geometry is missing', () => {
    const payload = structuredClone(enclave)
    payload.elements[0]!.members[1]!.geometry = []
    expect(() => parseMunicipalityBoundary(payload, 800)).toThrowError(expect.objectContaining({ kind: 'invalid-boundary' }))
  })

  it('rejects a detached inner member even when another enclave remains valid', () => {
    const payload = structuredClone(enclave)
    payload.elements[0]!.members.push({
      type: 'way', ref: 999, role: 'inner',
      geometry: [{ lat: 20, lon: 20 }, { lat: 20, lon: 21 }, { lat: 21, lon: 20 }, { lat: 20, lon: 20 }],
    })
    expect(() => parseMunicipalityBoundary(payload, 800)).toThrowError(expect.objectContaining({ kind: 'invalid-boundary' }))
  })

  it('accepts an outer ring assembled from multiple two-node members', () => {
    const payload = { elements: [{ type: 'relation', id: 10, members: [
      { type: 'way', ref: 1, role: 'outer', geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }] },
      { type: 'way', ref: 2, role: 'outer', geometry: [{ lat: 0, lon: 1 }, { lat: 1, lon: 1 }] },
      { type: 'way', ref: 3, role: 'outer', geometry: [{ lat: 1, lon: 1 }, { lat: 0, lon: 0 }] },
    ], tags: { name: 'Partido', boundary: 'administrative', type: 'boundary', admin_level: '8' } }] }
    expect(parseMunicipalityBoundary(payload, 10).geometry.type).toBe('Polygon')
  })

  it('rejects a non-administrative protected-area relation', () => {
    const payload = structuredClone(colmenarejo)
    payload.elements[0]!.tags.boundary = 'protected_area'
    expect(() => parseMunicipalityBoundary(payload, 347003)).toThrowError(expect.objectContaining({ kind: 'invalid-boundary' }))
  })
})

describe('parseStreetWays', () => {
  it('keeps unique named study streets and skips excluded ways', () => {
    const parsed = parseStreetWays(streets)

    expect(parsed).toHaveLength(3)
    expect(parsed.map((way) => way.sourceWayId)).toEqual([101, 102, 103])
    expect(parsed.some((way) => way.highway === 'footway')).toBe(false)
  })

  it('rejects out-of-range geometry on an eligible named street', () => {
    expect(() => parseStreetWays({ elements: [
      { type: 'way', id: 106, tags: { highway: 'residential', name: 'Calle Rota' }, geometry: [
        { lat: 91, lon: -4.01 }, { lat: 40.55, lon: -4 },
      ] },
    ] })).toThrowError(expect.objectContaining({ kind: 'invalid-response' }))
  })

  it('rejects a marked partial Overpass response defensively', () => {
    expect(() => parseStreetWays({ remark: 'runtime error: Query timed out', elements: streets.elements.slice(0, 1) }))
      .toThrowError(expect.objectContaining({ kind: 'timeout' }))
  })
})
