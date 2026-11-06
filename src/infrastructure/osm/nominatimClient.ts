import { mapEngineError, type BBox, type MunicipalityCandidate } from '../../domain/maps/types'
import { NOMINATIM_ENDPOINT } from './config'

interface NominatimResult {
  osm_type?: string
  osm_id?: number
  display_name?: string
  name?: string
  boundingbox?: string[]
  address?: Record<string, string | undefined>
  extratags?: Record<string, string | undefined>
}

export interface NominatimClient {
  searchMunicipalities(query: string, options: { countryCode: 'es'; signal: AbortSignal }): Promise<MunicipalityCandidate[]>
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toCandidate(item: NominatimResult): MunicipalityCandidate | undefined {
  if (item.osm_type !== 'relation' || typeof item.osm_id !== 'number') return undefined
  const address = item.address ?? {}
  const south = toNumber(item.boundingbox?.[0])
  const north = toNumber(item.boundingbox?.[1])
  const west = toNumber(item.boundingbox?.[2])
  const east = toNumber(item.boundingbox?.[3])
  const bbox: BBox | undefined = [west, south, east, north].every((value) => value !== undefined)
    ? [west!, south!, east!, north!]
    : undefined
  const municipalityName = item.name ?? address.town ?? address.village ?? address.municipality ?? item.display_name ?? `Relación ${item.osm_id}`

  return {
    osmType: 'relation',
    osmId: item.osm_id,
    displayName: item.display_name ?? municipalityName,
    municipalityName,
    province: address.province ?? address.county,
    region: address.state,
    country: address.country ?? 'España',
    countryCode: address.country_code ?? 'es',
    adminLevel: toNumber(item.extratags?.admin_level),
    bbox,
    confidence: 0,
    confidenceReason: 'Pendiente de clasificación',
  }
}

export function createNominatimClient(fetchImpl: typeof fetch = fetch): NominatimClient {
  return {
    async searchMunicipalities(query, options) {
      if (options.signal.aborted) throw mapEngineError('aborted', 'Búsqueda cancelada')
      const url = new URL(NOMINATIM_ENDPOINT)
      url.searchParams.set('q', query.trim())
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('countrycodes', options.countryCode)
      url.searchParams.set('addressdetails', '1')
      url.searchParams.set('extratags', '1')
      url.searchParams.set('limit', '10')

      try {
        const response = await fetchImpl(url, { signal: options.signal, headers: { Accept: 'application/json' } })
        if (!response.ok) throw mapEngineError('network', `Nominatim respondió ${response.status}`, response.status >= 500)
        const payload = await response.json() as unknown
        if (!Array.isArray(payload)) throw mapEngineError('invalid-response', 'Nominatim devolvió un formato inesperado')
        return payload.map((item) => toCandidate(item as NominatimResult)).filter((item): item is MunicipalityCandidate => item !== undefined)
      } catch (error) {
        if (options.signal.aborted) throw mapEngineError('aborted', 'Búsqueda cancelada', false, error)
        if (typeof error === 'object' && error && 'kind' in error) throw error
        throw mapEngineError('network', 'No se pudo consultar Nominatim', true, error)
      }
    },
  }
}

export const searchMunicipalities = createNominatimClient().searchMunicipalities
