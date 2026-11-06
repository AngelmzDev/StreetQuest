import { describe, expect, it } from 'vitest'
import type { MultiPolygonGeometry, PolygonGeometry } from './types'
import { validateBoundaryGeometry } from './boundaries'

describe('validateBoundaryGeometry', () => {
  it('computes bounds for a closed polygon with an inner ring', () => {
    const geometry: PolygonGeometry = { type: 'Polygon', coordinates: [
      [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
      [[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]],
    ] }

    expect(validateBoundaryGeometry(geometry)).toEqual([0, 0, 4, 4])
  })

  it('accepts disjoint outer polygons in a multipolygon', () => {
    const geometry: MultiPolygonGeometry = { type: 'MultiPolygon', coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      [[[5, 5], [6, 5], [6, 6], [5, 5]]],
    ] }

    expect(validateBoundaryGeometry(geometry)).toEqual([0, 0, 6, 6])
  })

  it.each([
    { type: 'Polygon', coordinates: [] },
    { type: 'Polygon', coordinates: [[[0, 0], [1, Number.NaN], [0, 0]]] },
    { type: 'Polygon', coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, -90]]] },
  ] as PolygonGeometry[])('rejects empty, non-finite, and implausibly large geometry', (geometry) => {
    expect(() => validateBoundaryGeometry(geometry)).toThrowError(expect.objectContaining({ kind: 'invalid-boundary' }))
  })
})
