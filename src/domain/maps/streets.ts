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

function midpoint(coordinates: Position[]): Position {
  const first = coordinates[0]!
  const last = coordinates.at(-1)!
  return [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2]
}

function isInsideBoundary(position: Position, boundary: MunicipalityBoundary): boolean {
  const candidate = point(position)
  if (boundary.geometry.type === 'Polygon') {
    return booleanPointInPolygon(candidate, polygon(boundary.geometry.coordinates), { ignoreBoundary: true })
  }
  return boundary.geometry.coordinates.some((coordinates) => booleanPointInPolygon(candidate, polygon(coordinates), { ignoreBoundary: true }))
}

function samePosition(left: Position, right: Position): boolean {
  return Math.abs(left[0] - right[0]) < 1e-10 && Math.abs(left[1] - right[1]) < 1e-10
}

export function clipWayToBoundary(way: SourceStreetWay, boundary: MunicipalityBoundary): StreetSegment[] {
  if (way.coordinates.length < 2) return []
  const boundaryFeature = boundary.geometry.type === 'Polygon'
    ? polygon(boundary.geometry.coordinates)
    : multiPolygon(boundary.geometry.coordinates)
  const parts: Position[][] = []
  for (let index = 1; index < way.coordinates.length; index += 1) {
    const start = way.coordinates[index - 1]!
    const end = way.coordinates[index]!
    const edge = lineString([start, end])
    const split = lineSplit(edge, boundaryFeature)
    const lines = (split.features.length > 0 ? split.features : [edge])
      .map((feature) => feature.geometry.coordinates as Position[])
      .sort((left, right) => {
        const distance = (position: Position) => (position[0] - start[0]) ** 2 + (position[1] - start[1]) ** 2
        return distance(left[0]!) - distance(right[0]!)
      })
    for (let coordinates of lines) {
      if (coordinates.length < 2 || !isInsideBoundary(midpoint(coordinates), boundary)) continue
      if (!samePosition(coordinates[0]!, start) && samePosition(coordinates.at(-1)!, start)) coordinates = [...coordinates].reverse()
      const previous = parts.at(-1)
      if (previous && samePosition(previous.at(-1)!, coordinates[0]!)) previous.push(...coordinates.slice(1))
      else parts.push([...coordinates])
    }
  }

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
