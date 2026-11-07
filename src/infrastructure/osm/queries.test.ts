import { describe, expect, it } from 'vitest'
import { buildBoundaryQuery, buildStreetQuery } from './queries'

describe('OpenStreetMap query builders', () => {
  it('targets exactly the requested municipal relation for boundary geometry', () => {
    const query = buildBoundaryQuery(12345)

    expect(query).toContain('relation(12345)')
    expect(query).toContain('out geom')
    expect(query).not.toContain('relation(12346)')
  })

  it('limits area street acquisition to named studyable highway categories', () => {
    const query = buildStreetQuery({ relationId: 12345, bbox: [-4.1, 40.4, -3.9, 40.6], mode: 'area' })

    expect(query).toContain('relation(12345)->.municipality')
    expect(query).toContain('map_to_area')
    expect(query).toContain('["name"]')
    expect(query).toContain('residential')
    expect(query).toContain('service')
    expect(query).not.toContain('footway|cycleway|path|track')
  })

  it('uses south, west, north, east order for the bbox fallback', () => {
    const query = buildStreetQuery({ relationId: 9, bbox: [-4.1, 40.4, -3.9, 40.6], mode: 'bbox' })

    expect(query).toContain('(40.4,-4.1,40.6,-3.9)')
    expect(query).not.toContain('map_to_area')
  })
})
