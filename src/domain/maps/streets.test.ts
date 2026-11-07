import { describe, expect, it } from 'vitest'
import type { MunicipalityBoundary, StreetSegment } from './types'
import { clipWayToBoundary, groupStreetSegments, normalizeStreetName, type SourceStreetWay } from './streets'

const squareBoundary: MunicipalityBoundary = {
  osmType: 'relation', osmId: 1, name: 'Cuadrado', bbox: [-1, -1, 1, 1],
  geometry: { type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]] },
}

function way(coordinates: SourceStreetWay['coordinates']): SourceStreetWay {
  return { sourceWayId: 42, name: 'Calle Mayor', highway: 'residential', coordinates }
}

describe('normalizeStreetName', () => {
  it('normalizes Unicode, case, and repeated whitespace without removing punctuation', () => {
    expect(normalizeStreetName('  CALLE   Constitución—Norte ')).toBe('calle constitución—norte')
    expect(normalizeStreetName('Av. Europa')).not.toBe(normalizeStreetName('Av Europa'))
  })
})

describe('clipWayToBoundary', () => {
  it('keeps only the part of a crossing way inside a polygon', () => {
    const segments = clipWayToBoundary(way([[-2, 0], [2, 0]]), squareBoundary)

    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ id: '42:0', sourceWayId: 42, partIndex: 0 })
    expect(segments[0]?.coordinates[0]?.[0]).toBeCloseTo(-1)
    expect(segments[0]?.coordinates.at(-1)?.[0]).toBeCloseTo(1)
  })

  it('creates stable parts for one way crossing two disjoint polygons', () => {
    const boundary: MunicipalityBoundary = {
      ...squareBoundary, bbox: [-3, -1, 3, 1], geometry: { type: 'MultiPolygon', coordinates: [
        [[[-3, -1], [-1, -1], [-1, 1], [-3, 1], [-3, -1]]],
        [[[1, -1], [3, -1], [3, 1], [1, 1], [1, -1]]],
      ] },
    }

    expect(clipWayToBoundary(way([[-4, 0], [4, 0]]), boundary).map((part) => part.id)).toEqual(['42:0', '42:1'])
  })

  it('excludes the portion crossing an inner enclave', () => {
    const boundary: MunicipalityBoundary = {
      ...squareBoundary, bbox: [0, 0, 4, 4], geometry: { type: 'Polygon', coordinates: [
        [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
        [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]],
      ] },
    }

    expect(clipWayToBoundary(way([[-1, 2], [5, 2]]), boundary)).toHaveLength(2)
  })

  it('does not retain an outside edge after touching and leaving the boundary', () => {
    const boundary: MunicipalityBoundary = {
      ...squareBoundary, bbox: [0, 0, 4, 4], geometry: { type: 'Polygon', coordinates: [
        [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
      ] },
    }
    const parts = clipWayToBoundary(way([[-1, 0], [0, 0], [0, 2], [-1, 2]]), boundary)
    expect(parts.flatMap((part) => part.coordinates)).not.toContainEqual([-1, 2])
  })

  it('does not retain a segment that lies on an enclave boundary', () => {
    const boundary: MunicipalityBoundary = {
      ...squareBoundary, bbox: [0, 0, 4, 4], geometry: { type: 'Polygon', coordinates: [
        [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
        [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]],
      ] },
    }
    const parts = clipWayToBoundary(way([[-1, 1], [1, 1], [3, 1], [5, 1]]), boundary)
    expect(parts.some((part) => part.coordinates.some(([x, y]) => y === 1 && x > 1 && x < 3))).toBe(false)
  })
})

describe('groupStreetSegments', () => {
  it('groups disconnected normalized names and generates deterministic street IDs', () => {
    const segments: StreetSegment[] = [
      { id: '1:0', sourceWayId: 1, partIndex: 0, name: 'Calle Mayor', highway: 'residential', coordinates: [[0, 0], [1, 0]] },
      { id: '2:0', sourceWayId: 2, partIndex: 0, name: ' CALLE   MAYOR ', highway: 'service', coordinates: [[5, 5], [6, 5]] },
    ]
    const first = groupStreetSegments('relation-1', segments)
    const second = groupStreetSegments('relation-1', [...segments].reverse())

    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({ name: 'Calle Mayor', normalizedName: 'calle mayor', highwayTypes: ['residential', 'service'] })
    expect(first[0]?.segments).toHaveLength(2)
    expect(second[0]?.id).toBe(first[0]?.id)
  })
})
