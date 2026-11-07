import { describe, expect, it } from 'vitest'
import { parseContextGeometry } from './contextGeometry'
import type { MunicipalityBoundary } from './types'

const boundary: MunicipalityBoundary = {
  osmType: 'relation', osmId: 1, name: 'Test', bbox: [0, 0, 2, 2],
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] },
}
describe('context geometry', () => {
  it('clips a building to the municipality and ignores an unclosed way', () => {
    const result = parseContextGeometry({ elements: [
      { type: 'way', id: 1, tags: { building: 'yes' }, geometry: [
        { lon: -1, lat: 0 }, { lon: 1, lat: 0 }, { lon: 1, lat: 1 }, { lon: -1, lat: 1 }, { lon: -1, lat: 0 },
      ] },
      { type: 'way', id: 2, tags: { building: 'yes' }, geometry: [{ lon: 0, lat: 0 }] },
    ] }, boundary)
    expect(result).toHaveLength(1)
    expect(result[0]?.kind).toBe('building')
    expect(JSON.stringify(result[0]?.geometry)).not.toContain('-1')
  })
})
