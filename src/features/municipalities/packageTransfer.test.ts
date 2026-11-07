import { describe, expect, it } from 'vitest'
import { parseMunicipalityPackage } from './packageTransfer'
import { createMunicipalityImporter } from './importMunicipality'
import { createMunicipalityStore } from '../../infrastructure/storage/municipalityStore'
import boundary from '../../test/fixtures/colmenarejo-boundary.json'
import streets from '../../test/fixtures/colmenarejo-streets.json'

async function fixture() {
  return createMunicipalityImporter({
    store: createMunicipalityStore('transfer-test'),
    nominatim: { searchMunicipalities: async () => [] },
    overpass: { executeOverpass: async (query) => query.includes('relation(') ? boundary : streets },
  }).importMunicipality({
    osmType: 'relation', osmId: 347003, municipalityName: 'Colmenarejo', displayName: 'Colmenarejo',
    country: 'España', countryCode: 'es', confidence: 150, confidenceReason: 'test',
  }, { signal: new AbortController().signal, onProgress: () => undefined })
}

describe('municipality file validation', () => {
  it('round trips a genuine engine package', async () => {
    const pkg = await fixture()
    expect(parseMunicipalityPackage(JSON.parse(JSON.stringify(pkg)))).toEqual(pkg)
  })
  it('rejects wrong identity, invalid geometry and malformed streets before saving', async () => {
    const pkg = await fixture()
    expect(() => parseMunicipalityPackage({ ...pkg, id: 'relation-1' })).toThrow()
    expect(() => parseMunicipalityPackage({ ...pkg, streets: [{}] })).toThrow()
    const broken = structuredClone(pkg)
    broken.streets[0]!.segments[0]!.coordinates[0] = [999, 0]
    expect(() => parseMunicipalityPackage(broken)).toThrow()
  })
})
