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
})

describe('parseStreetWays', () => {
  it('keeps unique named study streets and skips excluded or invalid ways', () => {
    const parsed = parseStreetWays(streets)

    expect(parsed).toHaveLength(3)
    expect(parsed.map((way) => way.sourceWayId)).toEqual([101, 102, 103])
    expect(parsed.some((way) => way.highway === 'footway')).toBe(false)
  })
})
