import { mapEngineError, type BBox, type BoundaryGeometry, type Position } from './types'

function isSamePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

export function closeBoundaryRings(geometry: BoundaryGeometry): BoundaryGeometry {
  const closeRing = (ring: Position[]): Position[] => {
    if (ring.length === 0) return ring
    return isSamePosition(ring[0]!, ring.at(-1)!) ? ring : [...ring, [...ring[0]!] as Position]
  }
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map(closeRing) }
  }
  return { ...geometry, coordinates: geometry.coordinates.map((polygon) => polygon.map(closeRing)) }
}

export function validateBoundaryGeometry(geometry: BoundaryGeometry): BBox {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (polygons.length === 0 || polygons.some((polygon) => polygon.length === 0)) {
    throw mapEngineError('invalid-boundary', 'El límite municipal no contiene polígonos')
  }

  let west = Number.POSITIVE_INFINITY
  let south = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY

  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (ring.length < 4 || !isSamePosition(ring[0]!, ring.at(-1)!)) {
        throw mapEngineError('invalid-boundary', 'El límite contiene un anillo abierto o incompleto')
      }
      for (const [longitude, latitude] of ring) {
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
          throw mapEngineError('invalid-boundary', 'El límite contiene coordenadas no válidas')
        }
        west = Math.min(west, longitude)
        south = Math.min(south, latitude)
        east = Math.max(east, longitude)
        north = Math.max(north, latitude)
      }
    }
  }

  if (!Number.isFinite(west) || east - west > 20 || north - south > 20) {
    throw mapEngineError('invalid-boundary', 'La extensión del límite municipal no es plausible')
  }
  return [west, south, east, north]
}
