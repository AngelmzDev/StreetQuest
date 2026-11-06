import osmtogeojson from 'osmtogeojson'
import { closeBoundaryRings, validateBoundaryGeometry } from '../../domain/maps/boundaries'
import { mapEngineError, type BoundaryGeometry, type MunicipalityBoundary } from '../../domain/maps/types'
import type { Position } from '../../domain/maps/types'
import type { SourceStreetWay } from '../../domain/maps/streets'

interface OverpassMember {
  role?: string
  geometry?: Array<{ lat?: number; lon?: number }>
}

interface OverpassRelation {
  type?: string
  id?: number
  members?: OverpassMember[]
  tags?: Record<string, string>
}

function relationFrom(payload: unknown, relationId: number): OverpassRelation {
  if (typeof payload !== 'object' || payload === null || !('elements' in payload) || !Array.isArray(payload.elements)) {
    throw mapEngineError('invalid-response', 'La respuesta de Overpass no contiene elementos')
  }
  const relation = (payload.elements as OverpassRelation[]).find((element) => element.type === 'relation' && element.id === relationId)
  if (!relation) throw mapEngineError('not-found', `No se encontró la relación municipal ${relationId}`)
  const usableOuter = relation.members?.some((member) => member.role === 'outer' && (member.geometry?.length ?? 0) >= 3)
  if (!usableOuter) throw mapEngineError('invalid-boundary', 'La relación municipal no contiene anillos exteriores utilizables')
  return relation
}

export function parseMunicipalityBoundary(payload: unknown, relationId: number): MunicipalityBoundary {
  const relation = relationFrom(payload, relationId)
  let collection: ReturnType<typeof osmtogeojson>
  try {
    collection = osmtogeojson(payload as Parameters<typeof osmtogeojson>[0])
  } catch (error) {
    throw mapEngineError('invalid-boundary', 'No se pudo reconstruir el límite municipal', false, error)
  }
  const feature = collection.features.find((item) => item.id === `relation/${relationId}`)
  if (!feature || (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
    throw mapEngineError('invalid-boundary', 'La relación no produjo un polígono municipal')
  }
  const geometry = closeBoundaryRings(feature.geometry as BoundaryGeometry)
  const bbox = validateBoundaryGeometry(geometry)

  return {
    osmType: 'relation',
    osmId: relationId,
    name: relation.tags?.name ?? `Municipio ${relationId}`,
    geometry,
    bbox,
  }
}

const STUDY_HIGHWAYS = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified',
  'residential', 'living_street', 'pedestrian', 'service',
])

interface OverpassWay {
  type?: string
  id?: number
  tags?: Record<string, string>
  geometry?: Array<{ lat?: number; lon?: number }>
}

export function parseStreetWays(payload: unknown): SourceStreetWay[] {
  if (typeof payload !== 'object' || payload === null || !('elements' in payload) || !Array.isArray(payload.elements)) {
    throw mapEngineError('invalid-response', 'La respuesta de calles no contiene elementos')
  }
  const unique = new Map<number, SourceStreetWay>()
  for (const element of payload.elements as OverpassWay[]) {
    const id = element.id
    const name = element.tags?.name?.trim()
    const highway = element.tags?.highway
    if (element.type !== 'way' || typeof id !== 'number' || unique.has(id) || !name || !highway || !STUDY_HIGHWAYS.has(highway)) continue
    const coordinates = element.geometry?.map(({ lon, lat }) => [lon, lat] as Position) ?? []
    if (coordinates.length < 2 || coordinates.some(([lon, lat]) => !Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90)) continue
    unique.set(id, { sourceWayId: id, name, highway, coordinates })
  }
  return [...unique.values()].sort((a, b) => a.sourceWayId - b.sourceWayId)
}
