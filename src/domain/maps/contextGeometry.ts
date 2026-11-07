import intersect from '@turf/intersect'
import { featureCollection, feature } from '@turf/helpers'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import type { BoundaryGeometry, ContextFeature, MunicipalityBoundary, Position } from './types'

interface ContextWay {
  type?: string
  id?: number
  tags?: Record<string, string>
  geometry?: Array<{ lon: number; lat: number }>
}

export function parseContextGeometry(payload: unknown, boundary: MunicipalityBoundary): ContextFeature[] {
  if (typeof payload !== 'object' || payload === null || !('elements' in payload) || !Array.isArray(payload.elements)) return []
  const result: ContextFeature[] = []
  const boundaryFeature = feature(boundary.geometry)
  const polygons = boundary.geometry.type === 'Polygon' ? [boundary.geometry.coordinates] : boundary.geometry.coordinates
  const edges = polygons.flatMap((polygon) => polygon.flatMap((ring) => ring.slice(1).map((end, index) => {
    const start = ring[index]!
    return [Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.max(start[0], end[0]), Math.max(start[1], end[1])]
  })))
  let coordinates = 0
  const seen = new Set<number>()
  for (const way of payload.elements as ContextWay[]) {
    if (way.type !== 'way' || !Number.isSafeInteger(way.id) || seen.has(way.id!)) continue
    seen.add(way.id!)
    const tags = way.tags ?? {}
    let kind: ContextFeature['kind'] | undefined
    if (tags.building && tags.building !== 'no') kind = 'building'
    else if (tags.natural === 'water' || tags.waterway === 'riverbank') kind = 'water'
    else if (['park', 'garden', 'recreation_ground'].includes(tags.leisure ?? '')
      || ['forest', 'grass', 'meadow', 'village_green'].includes(tags.landuse ?? '')
      || ['wood', 'scrub', 'grassland'].includes(tags.natural ?? '')) kind = 'green'
    if (!kind || !Array.isArray(way.geometry) || way.geometry.length < 4) continue
    const ring = way.geometry.map(({ lon, lat }) => [lon, lat] as Position)
    if (ring.some(([lon, lat]) => !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90)) continue
    if (ring[0]![0] !== ring.at(-1)![0] || ring[0]![1] !== ring.at(-1)![1]) continue
    coordinates += ring.length
    if (coordinates > 2_000_000 || result.length >= 50_000) throw new Error('El contexto del mapa supera el límite de seguridad.')
    const bounds = ring.reduce((box, [lon, lat]) => [
      Math.min(box[0]!, lon), Math.min(box[1]!, lat), Math.max(box[2]!, lon), Math.max(box[3]!, lat),
    ], [Infinity, Infinity, -Infinity, -Infinity])
    const touchesBoundary = edges.some(([west, south, east, north]) =>
      east! >= bounds[0]! && west! <= bounds[2]! && north! >= bounds[1]! && south! <= bounds[3]!)
    if (!touchesBoundary) {
      if (booleanPointInPolygon(ring[0]!, boundaryFeature)) {
        result.push({ id: `way-${way.id}`, kind, geometry: { type: 'Polygon', coordinates: [ring] } })
      }
      continue
    }
    try {
      const clipped = intersect(featureCollection([
        feature({ type: 'Polygon', coordinates: [ring] }),
        boundaryFeature,
      ]))
      if (clipped) result.push({ id: `way-${way.id}`, kind, geometry: clipped.geometry as BoundaryGeometry })
    } catch {
      // Una geometría de contexto inválida no impide estudiar las calles.
    }
  }
  return result
}
