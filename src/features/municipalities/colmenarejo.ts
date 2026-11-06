import type { MunicipalityStore } from '../../infrastructure/storage/municipalityStore'
import { createMunicipalityImporter } from './importMunicipality'

const candidate = {
  osmType: 'relation' as const,
  osmId: 347003,
  displayName: 'Colmenarejo, Comunidad de Madrid, España',
  municipalityName: 'Colmenarejo',
  province: 'Madrid',
  region: 'Comunidad de Madrid',
  country: 'España',
  countryCode: 'es',
  adminLevel: 8,
  confidence: 150,
  confidenceReason: 'Mapa incluido',
}

export async function openBundledColmenarejo(store: MunicipalityStore) {
  const cached = await store.get('relation-347003')
  if (cached) return cached
  const response = await fetch(`${import.meta.env.BASE_URL}colmenarejo-osm.json`)
  if (!response.ok) throw new Error('El mapa incluido no está disponible.')
  const snapshot = await response.json() as { boundary: unknown; streets: unknown; capturedAt: string }
  const importer = createMunicipalityImporter({
    store,
    nominatim: { searchMunicipalities: async () => [candidate] },
    overpass: { executeOverpass: async (query) => query.includes('relation(') ? snapshot.boundary : snapshot.streets },
    overpassEndpoint: 'https://api.openstreetmap.org/api/0.6',
    now: () => new Date(snapshot.capturedAt),
  })
  return importer.importMunicipality(candidate, { signal: new AbortController().signal, onProgress: () => undefined })
}
