import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { lineString, multiPolygon, point, polygon } from '@turf/helpers'
import lineSplit from '@turf/line-split'
import type { MunicipalityBoundary, Position, Street, StreetSegment } from './types'

export interface SourceStreetWay {
  sourceWayId: number
  name: string
  highway: string
  coordinates: Position[]
}

export function normalizeStreetName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function midpointOfFirstEdge(coordinates: Position[]): Position {
  const first = coordinates[0]!
  const second = coordinates[1]!
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2]
}

function isInsideBoundary(position: Position, boundary: MunicipalityBoundary): boolean {
  const candidate = point(position)
  if (boundary.geometry.type === 'Polygon') {
    return booleanPointInPolygon(candidate, polygon(boundary.geometry.coordinates))
  }
  return boundary.geometry.coordinates.some((coordinates) => booleanPointInPolygon(candidate, polygon(coordinates)))
}

export function clipWayToBoundary(way: SourceStreetWay, boundary: MunicipalityBoundary): StreetSegment[] {
  if (way.coordinates.length < 2) return []
  const source = lineString(way.coordinates)
  const boundaryFeature = boundary.geometry.type === 'Polygon'
    ? polygon(boundary.geometry.coordinates)
    : multiPolygon(boundary.geometry.coordinates)
  const split = lineSplit(source, boundaryFeature)
  const lines = split.features.length > 0 ? split.features : [source]
  const parts = lines
    .map((feature) => feature.geometry.coordinates as Position[])
    .filter((coordinates) => coordinates.length >= 2 && isInsideBoundary(midpointOfFirstEdge(coordinates), boundary))
    .sort((a, b) => `${a[0]![0]},${a[0]![1]}`.localeCompare(`${b[0]![0]},${b[0]![1]}`, 'en'))

  return parts.map((coordinates, partIndex) => ({
    id: `${way.sourceWayId}:${partIndex}`,
    sourceWayId: way.sourceWayId,
    partIndex,
    name: way.name.trim().replace(/\s+/g, ' '),
    highway: way.highway,
    coordinates,
  }))
}

export function groupStreetSegments(municipalityId: string, segments: StreetSegment[]): Street[] {
  const groups = new Map<string, StreetSegment[]>()
  for (const segment of segments) {
    const key = normalizeStreetName(segment.name)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), segment])
  }

  return [...groups.entries()].map(([normalizedName, members]) => {
    const sorted = [...members].sort((a, b) => a.sourceWayId - b.sourceWayId || a.partIndex - b.partIndex)
    return {
      id: `street-${fnv1a(`${municipalityId}:${normalizedName}`)}`,
      name: sorted[0]!.name,
      normalizedName,
      highwayTypes: [...new Set(sorted.map((segment) => segment.highway))].sort(),
      segments: sorted,
    }
  }).sort((a, b) => a.normalizedName.localeCompare(b.normalizedName, 'es'))
}
