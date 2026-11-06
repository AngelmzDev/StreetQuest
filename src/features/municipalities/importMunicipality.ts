import { rankCandidates } from '../../domain/maps/candidates'
import { assertPackageLimits } from '../../domain/maps/limits'
import { clipWayToBoundary, groupStreetSegments } from '../../domain/maps/streets'
import { mapEngineError, type ImportPhase, type MapEngineError, type MunicipalityCandidate, type MunicipalityPackage } from '../../domain/maps/types'
import { DEFAULT_MAX_RESPONSE_BYTES, DEFAULT_TIMEOUT_MS } from '../../infrastructure/osm/config'
import { parseMunicipalityBoundary, parseStreetWays } from '../../infrastructure/osm/parsers'
import { buildBoundaryQuery, buildStreetQuery } from '../../infrastructure/osm/queries'
import type { MunicipalityStore } from '../../infrastructure/storage/municipalityStore'

export interface NominatimGateway {
  searchMunicipalities(query: string, options: { countryCode: 'es'; signal: AbortSignal }): Promise<MunicipalityCandidate[]>
}

export interface OverpassGateway {
  executeOverpass(query: string, options: { signal: AbortSignal; timeoutMs: number; maxBytes: number }): Promise<unknown>
}

export type DiscoveryResult =
  | { kind: 'none' }
  | { kind: 'selection-required'; candidates: MunicipalityCandidate[] }
  | { kind: 'selected'; candidate: MunicipalityCandidate }

export interface ImportOptions {
  signal: AbortSignal
  onProgress(phase: ImportPhase): void
}

interface ImporterDependencies {
  nominatim: NominatimGateway
  overpass: OverpassGateway
  store: MunicipalityStore
  now?: () => Date
  delay?: (milliseconds: number) => Promise<void>
  overpassEndpoint?: string
}

function hasErrorKind(error: unknown, kind: string): boolean {
  return typeof error === 'object' && error !== null && 'kind' in error && error.kind === kind
}

function isRetryable(error: unknown): error is MapEngineError {
  return typeof error === 'object' && error !== null && 'retryable' in error && error.retryable === true
}

function payloadStats(payload: unknown) {
  const serialized = JSON.stringify(payload)
  const elements = typeof payload === 'object' && payload !== null && 'elements' in payload && Array.isArray(payload.elements)
    ? payload.elements as Array<{ geometry?: unknown[] }>
    : []
  return {
    rawBytes: new TextEncoder().encode(serialized).byteLength,
    elementCount: elements.length,
    coordinateCount: elements.reduce((total, element) => total + (Array.isArray(element.geometry) ? element.geometry.length : 0), 0),
    serializedBytes: 0,
  }
}

function sourceTimestamp(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || !('osm3s' in payload)) return undefined
  const osm3s = payload.osm3s
  return typeof osm3s === 'object' && osm3s !== null && 'timestamp_osm_base' in osm3s && typeof osm3s.timestamp_osm_base === 'string'
    ? osm3s.timestamp_osm_base
    : undefined
}

export function createMunicipalityImporter(dependencies: ImporterDependencies) {
  const now = dependencies.now ?? (() => new Date())
  const delay = dependencies.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  const endpoint = dependencies.overpassEndpoint ?? 'https://overpass-api.de/api/interpreter'

  async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        if (attempt === 2 || !isRetryable(error)) throw error
        await delay(250)
      }
    }
    throw new Error('unreachable')
  }

  async function discoverMunicipalities(input: { query: string; province?: string; signal: AbortSignal }): Promise<DiscoveryResult> {
    if (input.signal.aborted) throw mapEngineError('aborted', 'Búsqueda cancelada')
    const candidates = await dependencies.nominatim.searchMunicipalities(input.query, { countryCode: 'es', signal: input.signal })
    const ranked = rankCandidates(candidates, { query: input.query, province: input.province })
    if (ranked.length === 0) return { kind: 'none' }
    if (ranked.length > 1 && ranked[0]!.confidence === ranked[1]!.confidence) {
      return { kind: 'selection-required', candidates: ranked }
    }
    return { kind: 'selected', candidate: ranked[0]! }
  }

  async function importMunicipality(candidate: MunicipalityCandidate, options: ImportOptions): Promise<MunicipalityPackage> {
    if (options.signal.aborted) throw mapEngineError('aborted', 'Importación cancelada')
    options.onProgress('discovering-boundary')
    const requestOptions = { signal: options.signal, timeoutMs: DEFAULT_TIMEOUT_MS, maxBytes: DEFAULT_MAX_RESPONSE_BYTES }
    const boundaryPayload = await withRetry(() => dependencies.overpass.executeOverpass(buildBoundaryQuery(candidate.osmId), requestOptions))
    assertPackageLimits(payloadStats(boundaryPayload))
    const boundary = parseMunicipalityBoundary(boundaryPayload, candidate.osmId)

    options.onProgress('downloading-geometry')
    let streetPayload = await withRetry(() => dependencies.overpass.executeOverpass(
      buildStreetQuery({ relationId: candidate.osmId, bbox: boundary.bbox, mode: 'area' }),
      requestOptions,
    ))
    let ways = parseStreetWays(streetPayload)
    if (ways.length === 0) {
      streetPayload = await withRetry(() => dependencies.overpass.executeOverpass(
        buildStreetQuery({ relationId: candidate.osmId, bbox: boundary.bbox, mode: 'bbox' }),
        requestOptions,
      ))
      ways = parseStreetWays(streetPayload)
    }
    const streetStats = payloadStats(streetPayload)
    assertPackageLimits(streetStats)

    options.onProgress('processing-streets')
    const municipalityId = `relation-${candidate.osmId}`
    const segments = ways.flatMap((way) => clipWayToBoundary(way, boundary))
    const streets = groupStreetSegments(municipalityId, segments)
    const pkg: MunicipalityPackage = {
      schemaVersion: 1,
      id: municipalityId,
      municipality: candidate,
      boundary,
      streets,
      source: {
        provider: 'OpenStreetMap',
        overpassEndpoint: endpoint,
        sourceTimestamp: sourceTimestamp(boundaryPayload),
        fetchedAt: now().toISOString(),
        attribution: '© OpenStreetMap contributors',
      },
    }
    const serializedBytes = new TextEncoder().encode(JSON.stringify(pkg)).byteLength
    assertPackageLimits({ ...streetStats, coordinateCount: segments.reduce((total, segment) => total + segment.coordinates.length, 0), serializedBytes })

    options.onProgress('saving-locally')
    await dependencies.store.replaceAtomically(pkg)
    return pkg
  }

  async function refreshMunicipality(cached: MunicipalityPackage, options: ImportOptions): Promise<MunicipalityPackage> {
    try {
      return await importMunicipality(cached.municipality, options)
    } catch (error) {
      if (!hasErrorKind(error, 'not-found') && !hasErrorKind(error, 'invalid-boundary')) throw error
      const discovery = await discoverMunicipalities({
        query: cached.municipality.municipalityName,
        province: cached.municipality.province,
        signal: options.signal,
      })
      if (discovery.kind === 'selected') return importMunicipality(discovery.candidate, options)
      throw mapEngineError('not-found', 'El límite anterior cambió y es necesario elegir de nuevo el municipio', false, discovery)
    }
  }

  return { discoverMunicipalities, importMunicipality, refreshMunicipality }
}

export type MunicipalityImporter = ReturnType<typeof createMunicipalityImporter>
