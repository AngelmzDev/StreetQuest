import { describe, expect, it } from 'vitest'
import type { MunicipalityCandidate } from './types'
import { rankCandidates } from './candidates'

function candidate(overrides: Partial<MunicipalityCandidate> = {}): MunicipalityCandidate {
  return {
    osmType: 'relation', osmId: 1, displayName: 'Colmenarejo, Madrid, España', municipalityName: 'Colmenarejo',
    province: 'Madrid', region: 'Comunidad de Madrid', country: 'España', countryCode: 'es', adminLevel: 8,
    confidence: 0, confidenceReason: '', ...overrides,
  }
}

describe('rankCandidates', () => {
  it('prefers a matching Spanish admin-level-8 relation', () => {
    const ranked = rankCandidates([
      candidate({ osmId: 2, adminLevel: 9 }),
      candidate({ osmId: 1, adminLevel: 8 }),
    ], { query: 'Colmenarejo' })

    expect(ranked[0]).toMatchObject({ osmId: 1, confidenceReason: expect.stringContaining('nivel administrativo 8') })
  })

  it('uses province context to avoid a same-name place elsewhere', () => {
    const ranked = rankCandidates([
      candidate({ osmId: 1, province: 'Madrid' }),
      candidate({ osmId: 2, province: 'Salamanca' }),
    ], { query: 'Colmenarejo', province: 'Madrid' })

    expect(ranked[0]?.osmId).toBe(1)
    expect(ranked[0]?.confidence).toBeGreaterThan(ranked[1]?.confidence ?? 0)
  })

  it('marks equal top candidates as requiring explicit selection', () => {
    const ranked = rankCandidates([
      candidate({ osmId: 2, displayName: 'Colmenarejo B' }),
      candidate({ osmId: 1, displayName: 'Colmenarejo A' }),
    ], { query: 'Colmenarejo' })

    expect(ranked[0]?.confidence).toBe(ranked[1]?.confidence)
    expect(ranked[0]?.confidenceReason).toContain('selección')
    expect(ranked.map((item) => item.osmId)).toEqual([1, 2])
  })

  it('deduplicates repeated Nominatim results for the same relation', () => {
    const ranked = rankCandidates([
      candidate({ osmId: 1, displayName: 'Primera copia' }),
      candidate({ osmId: 1, displayName: 'Segunda copia' }),
    ], { query: 'Colmenarejo' })

    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.osmId).toBe(1)
  })
})
