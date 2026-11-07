import type { MunicipalityPackage, Position } from '../../domain/maps/types'
import { validateBoundaryGeometry } from '../../domain/maps/boundaries'
import type { MunicipalityStore } from '../../infrastructure/storage/municipalityStore'

export const MAX_PACKAGE_BYTES = 128 * 1024 * 1024

function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new Error('El archivo no es un paquete municipal válido de StreetQuest.')
}

function object(value: unknown): Record<string, unknown> {
  requireValue(typeof value === 'object' && value !== null && !Array.isArray(value))
  return value as Record<string, unknown>
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 2000
}

function position(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2
    && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
}

export function parseMunicipalityPackage(input: unknown): MunicipalityPackage {
  const pkg = object(input)
  const municipality = object(pkg.municipality)
  const boundary = object(pkg.boundary)
  const source = object(pkg.source)
  requireValue(pkg.schemaVersion === 1 && Number.isSafeInteger(municipality.osmId) && Number(municipality.osmId) > 0)
  requireValue(pkg.id === `relation-${municipality.osmId}` && municipality.osmType === 'relation')
  requireValue(boundary.osmType === 'relation' && boundary.osmId === municipality.osmId)
  requireValue(text(municipality.municipalityName) && text(municipality.displayName))
  requireValue(text(municipality.country) && text(municipality.countryCode))
  requireValue(typeof municipality.confidence === 'number' && Number.isFinite(municipality.confidence) && typeof municipality.confidenceReason === 'string')
  requireValue(municipality.province === undefined || text(municipality.province))
  requireValue(text(boundary.name))
  const geometry = object(boundary.geometry)
  requireValue(geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')
  requireValue(Array.isArray(geometry.coordinates))
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  let count = 0
  for (const polygon of polygons) {
    requireValue(Array.isArray(polygon) && polygon.length > 0)
    for (const ring of polygon) {
      requireValue(Array.isArray(ring) && ring.every(position))
      count += ring.length
    }
  }
  requireValue(count <= 2_000_000)
  const typed = pkg as unknown as MunicipalityPackage
  const bbox = validateBoundaryGeometry(typed.boundary.geometry)
  requireValue(Array.isArray(boundary.bbox) && boundary.bbox.length === 4 && boundary.bbox.every((item, index) => item === bbox[index]))
  requireValue(source.provider === 'OpenStreetMap' && text(source.attribution) && text(source.overpassEndpoint))
  requireValue(typeof source.fetchedAt === 'string' && Number.isFinite(Date.parse(source.fetchedAt)))
  requireValue(Array.isArray(pkg.streets) && pkg.streets.length <= 250_000)
  const ids = new Set<string>()
  for (const value of pkg.streets) {
    const street = object(value)
    requireValue(text(street.id) && !ids.has(street.id) && text(street.name) && text(street.normalizedName))
    ids.add(street.id)
    requireValue(Array.isArray(street.highwayTypes) && street.highwayTypes.every(text))
    requireValue(Array.isArray(street.segments) && street.segments.length > 0)
    for (const value of street.segments) {
      const segment = object(value)
      requireValue(text(segment.id) && text(segment.name) && text(segment.highway))
      requireValue(Number.isSafeInteger(segment.sourceWayId) && Number(segment.sourceWayId) >= 0)
      requireValue(Number.isSafeInteger(segment.partIndex) && Number(segment.partIndex) >= 0)
      requireValue(Array.isArray(segment.coordinates) && segment.coordinates.length >= 2 && segment.coordinates.every(position))
      count += segment.coordinates.length
      requireValue(count <= 2_000_000)
    }
  }
  if (pkg.context !== undefined) {
    requireValue(Array.isArray(pkg.context) && pkg.context.length <= 50_000)
    for (const value of pkg.context) {
      const item = object(value)
      requireValue(text(item.id) && ['building', 'green', 'water'].includes(String(item.kind)))
      const geometry = object(item.geometry)
      requireValue(geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')
      requireValue(Array.isArray(geometry.coordinates))
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
      for (const polygon of polygons) {
        requireValue(Array.isArray(polygon) && polygon.length > 0)
        for (const ring of polygon) {
          requireValue(Array.isArray(ring) && ring.every(position))
          count += ring.length
          requireValue(count <= 2_000_000)
        }
      }
      validateBoundaryGeometry(geometry as unknown as MunicipalityPackage['boundary']['geometry'])
    }
  }
  return typed
}

export async function readPackageFile(file: File): Promise<MunicipalityPackage> {
  if (file.size > MAX_PACKAGE_BYTES) throw new Error('El archivo supera el límite de 128 MiB.')
  return parseMunicipalityPackage(JSON.parse(await file.text()))
}

export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportMunicipality(store: MunicipalityStore, id: string) {
  const pkg = await store.get(id)
  if (!pkg) throw new Error('El mapa ya no está disponible.')
  downloadJson(pkg, `streetquest-${pkg.id}.json`)
}
