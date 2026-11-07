import { describe, expect, it } from 'vitest'
import type { MunicipalityPackage } from '../../domain/maps/types'
import { createMunicipalityStore } from './municipalityStore'

let databaseCounter = 0
const databaseName = () => `streetquest-test-${databaseCounter++}`

function packageFixture(id: string, fetchedAt: string, name = id): MunicipalityPackage {
  return {
    schemaVersion: 1,
    id,
    municipality: {
      osmType: 'relation', osmId: Number(id.replace(/\D/g, '')) || 1, displayName: name, municipalityName: name,
      province: 'Madrid', region: 'Comunidad de Madrid', country: 'España', countryCode: 'es', adminLevel: 8,
      confidence: 190, confidenceReason: 'fixture',
    },
    boundary: {
      osmType: 'relation', osmId: 1, name, bbox: [0, 0, 1, 1],
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    },
    streets: [{ id: 'street-1', name: 'Calle Uno', normalizedName: 'calle uno', highwayTypes: ['residential'], segments: [] }],
    source: { provider: 'OpenStreetMap', overpassEndpoint: 'https://overpass.test', fetchedAt, attribution: '© OpenStreetMap contributors' },
  }
}

describe('MunicipalityStore', () => {
  it('starts empty and round-trips a municipality package', async () => {
    const store = createMunicipalityStore(databaseName())
    const pkg = packageFixture('relation-1', '2026-11-06T10:00:00.000Z')

    expect(await store.list()).toEqual([])
    await store.replaceAtomically(pkg)

    expect(await store.get(pkg.id)).toEqual(pkg)
    expect(await store.list()).toEqual([{ id: pkg.id, name: pkg.municipality.municipalityName, province: 'Madrid', streetCount: 1, fetchedAt: pkg.source.fetchedAt }])
  })

  it('lists newest downloads first and replaces without duplicate summaries', async () => {
    const store = createMunicipalityStore(databaseName())
    await store.replaceAtomically(packageFixture('relation-1', '2026-11-05T10:00:00.000Z'))
    await store.replaceAtomically(packageFixture('relation-2', '2026-11-06T10:00:00.000Z'))
    await store.replaceAtomically(packageFixture('relation-1', '2026-11-07T10:00:00.000Z', 'Uno actualizado'))

    expect((await store.list()).map((summary) => summary.name)).toEqual(['Uno actualizado', 'relation-2'])
  })

  it('removes both package and summary', async () => {
    const store = createMunicipalityStore(databaseName())
    await store.replaceAtomically(packageFixture('relation-1', '2026-11-06T10:00:00.000Z'))

    await store.remove('relation-1')

    expect(await store.get('relation-1')).toBeUndefined()
    expect(await store.list()).toEqual([])
  })

  it('rejects packages from an unsupported schema version', async () => {
    const store = createMunicipalityStore(databaseName())
    const pkg = { ...packageFixture('relation-1', '2026-11-06T10:00:00.000Z'), schemaVersion: 2 } as unknown as MunicipalityPackage

    await expect(store.replaceAtomically(pkg)).rejects.toMatchObject({ kind: 'storage', retryable: false })
  })

  it('aborts the whole replacement and preserves the previous package', async () => {
    const name = databaseName()
    const original = packageFixture('relation-1', '2026-11-06T10:00:00.000Z', 'Original')
    await createMunicipalityStore(name).replaceAtomically(original)
    const failing = createMunicipalityStore(name, { beforeSummaryPut: () => { throw new Error('simulated write failure') } })

    await expect(failing.replaceAtomically(packageFixture('relation-1', '2026-11-07T10:00:00.000Z', 'Roto')))
      .rejects.toMatchObject({ kind: 'storage' })
    expect(await failing.get('relation-1')).toEqual(original)
  })

  it('maps quota errors without replacing the existing package', async () => {
    const name = databaseName()
    const original = packageFixture('relation-1', '2026-11-06T10:00:00.000Z', 'Original')
    await createMunicipalityStore(name).replaceAtomically(original)
    const failing = createMunicipalityStore(name, { beforeSummaryPut: () => { throw new DOMException('full', 'QuotaExceededError') } })

    await expect(failing.replaceAtomically(packageFixture('relation-1', '2026-11-07T10:00:00.000Z', 'Nuevo')))
      .rejects.toMatchObject({ kind: 'storage-quota', retryable: false })
    expect(await failing.get('relation-1')).toEqual(original)
  })

  it('atomically replaces a superseded relation ID without leaving a duplicate card', async () => {
    const store = createMunicipalityStore(databaseName())
    await store.replaceAtomically(packageFixture('relation-1', '2026-11-06T10:00:00.000Z', 'Anterior'))
    const replacement = packageFixture('relation-2', '2026-11-07T10:00:00.000Z', 'Nuevo')

    await store.replaceAndRemoveAtomically(replacement, 'relation-1')

    expect(await store.get('relation-1')).toBeUndefined()
    expect(await store.get('relation-2')).toEqual(replacement)
    expect((await store.list()).map((item) => item.id)).toEqual(['relation-2'])
  })
})
