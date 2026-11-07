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

function rejectRuntimeRemark(payload: unknown): void {
  if (typeof payload !== 'object' || payload === null || !('remark' in payload) || typeof payload.remark !== 'string') return
  if (/timed?\s*out|timeout/i.test(payload.remark)) throw mapEngineError('timeout', 'Overpass agotó el tiempo de ejecución', true, payload.remark)
  throw mapEngineError('invalid-response', 'Overpass devolvió una respuesta parcial', true, payload.remark)
}

function relationFrom(payload: unknown, relationId: number): OverpassRelation {
  rejectRuntimeRemark(payload)
  if (typeof payload !== 'object' || payload === null || !('elements' in payload) || !Array.isArray(payload.elements)) {
    throw mapEngineError('invalid-response', 'La respuesta de Overpass no contiene elementos')
  }
  const relation = (payload.elements as OverpassRelation[]).find((element) => element.type === 'relation' && element.id === relationId)
  if (!relation) throw mapEngineError('not-found', `No se encontró la relación municipal ${relationId}`)
  if (relation.tags?.boundary !== 'administrative' || relation.tags.admin_level !== '8' || !['boundary', 'multipolygon'].includes(relation.tags?.type ?? '')) {
    throw mapEngineError('invalid-boundary', 'La relación no es un límite administrativo municipal')
  }
  const boundaryMembers = relation.members?.filter((member) => member.role === 'outer' || member.role === 'inner') ?? []
  if (!boundaryMembers.some((member) => member.role === 'outer')) {
    throw mapEngineError('invalid-boundary', 'La relación municipal no contiene anillos exteriores')
  }
  if (boundaryMembers.some((member) => !Array.isArray(member.geometry) || member.geometry.length < 2)) {
    throw mapEngineError('invalid-boundary', 'La relación municipal contiene miembros geométricos incompletos')
  }
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
  const expectedInner = relation.members?.some((member) => member.role === 'inner') ?? false
  const hasInner = geometry.type === 'Polygon'
    ? geometry.coordinates.length > 1
    : geometry.coordinates.some((part) => part.length > 1)
  if (expectedInner && !hasInner) throw mapEngineError('invalid-boundary', 'No se pudieron reconstruir todos los enclaves municipales')
  const coordinateKey = ({ lon, lat }: { lon?: number; lat?: number }) => `${lon?.toFixed(7)},${lat?.toFixed(7)}`
  const geometryKey = ([lon, lat]: Position) => `${lon.toFixed(7)},${lat.toFixed(7)}`
  const polygonParts = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const outputByRole = {
    outer: new Set(polygonParts.flatMap((part) => part[0] ?? []).map(geometryKey)),
    inner: new Set(polygonParts.flatMap((part) => part.slice(1).flat()).map(geometryKey)),
  }
  const hasLostMember = relation.members?.some((member) => {
    if (member.role !== 'outer' && member.role !== 'inner') return false
    return member.geometry?.some((coordinate) => !outputByRole[member.role as 'outer' | 'inner'].has(coordinateKey(coordinate)))
  })
  if (hasLostMember) throw mapEngineError('invalid-boundary', 'La reconstrucción perdió miembros del límite municipal')
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
  rejectRuntimeRemark(payload)
  if (typeof payload !== 'object' || payload === null || !('elements' in payload) || !Array.isArray(payload.elements)) {
    throw mapEngineError('invalid-response', 'La respuesta de calles no contiene elementos')
  }
  const unique = new Map<number, SourceStreetWay>()
  for (const element of payload.elements as OverpassWay[]) {
    if (typeof element !== 'object' || element === null) throw mapEngineError('invalid-response', 'La respuesta contiene un elemento OSM no válido')
    const id = element.id
    const name = typeof element.tags?.name === 'string' ? element.tags.name.trim() : undefined
    const highway = element.tags?.highway
    if (element.type !== 'way' || !name || !highway || !STUDY_HIGHWAYS.has(highway)) continue
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) throw mapEngineError('invalid-response', 'La respuesta contiene una calle sin identificador válido')
    if (unique.has(id)) continue
    if (!Array.isArray(element.geometry) || element.geometry.length < 2 || element.geometry.some((coordinate) =>
      !coordinate || typeof coordinate.lon !== 'number' || typeof coordinate.lat !== 'number'
      || !Number.isFinite(coordinate.lon) || !Number.isFinite(coordinate.lat)
      || Math.abs(coordinate.lon) > 180 || Math.abs(coordinate.lat) > 90)) {
      throw mapEngineError('invalid-response', 'La respuesta contiene una calle con geometría incompleta o no válida')
    }
    const coordinates = element.geometry.map(({ lon, lat }) => [lon, lat] as Position)
    unique.set(id, { sourceWayId: id, name, highway, coordinates })
  }
  return [...unique.values()].sort((a, b) => a.sourceWayId - b.sourceWayId)
}
