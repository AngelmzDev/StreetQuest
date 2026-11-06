export type OsmType = 'relation' | 'way'

export interface OsmIdentity {
  osmType: OsmType
  osmId: number
}

export type Position = [longitude: number, latitude: number]
export type BBox = [west: number, south: number, east: number, north: number]

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: Position[][]
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Position[][][]
}

export type BoundaryGeometry = PolygonGeometry | MultiPolygonGeometry

export interface MunicipalityCandidate extends OsmIdentity {
  osmType: 'relation'
  displayName: string
  municipalityName: string
  province?: string
  region?: string
  country: string
  countryCode: string
  adminLevel?: number
  bbox?: BBox
  confidence: number
  confidenceReason: string
}

export interface MunicipalityBoundary extends OsmIdentity {
  osmType: 'relation'
  name: string
  geometry: BoundaryGeometry
  bbox: BBox
}

export interface StreetSegment {
  id: string
  sourceWayId: number
  partIndex: number
  name: string
  highway: string
  coordinates: Position[]
}

export interface Street {
  id: string
  name: string
  normalizedName: string
  highwayTypes: string[]
  segments: StreetSegment[]
}

export interface SourceMetadata {
  provider: 'OpenStreetMap'
  overpassEndpoint: string
  sourceTimestamp?: string
  fetchedAt: string
  attribution: string
}

export interface MunicipalityPackage {
  schemaVersion: 1
  id: string
  municipality: MunicipalityCandidate
  boundary: MunicipalityBoundary
  streets: Street[]
  source: SourceMetadata
}

export interface CachedMunicipalitySummary {
  id: string
  name: string
  province?: string
  streetCount: number
  fetchedAt: string
}

export type ImportPhase =
  | 'discovering-boundary'
  | 'downloading-geometry'
  | 'processing-streets'
  | 'saving-locally'

export type MapEngineErrorKind =
  | 'aborted'
  | 'offline'
  | 'timeout'
  | 'rate-limited'
  | 'network'
  | 'invalid-response'
  | 'invalid-boundary'
  | 'limit-exceeded'
  | 'storage-quota'
  | 'storage'
  | 'selection-required'
  | 'not-found'

export interface MapEngineError extends Error {
  kind: MapEngineErrorKind
  retryable: boolean
  cause?: unknown
}

export function mapEngineError(
  kind: MapEngineErrorKind,
  message: string,
  retryable = false,
  cause?: unknown,
): MapEngineError {
  return Object.assign(new Error(message), { kind, retryable, cause })
}
