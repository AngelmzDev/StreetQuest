import { mapEngineError } from './types'

export interface PackageStats {
  rawBytes: number
  elementCount: number
  coordinateCount: number
  serializedBytes: number
}

export type PackageLimits = PackageStats

export const DEFAULT_PACKAGE_LIMITS: PackageLimits = {
  rawBytes: 64 * 1024 * 1024,
  elementCount: 250_000,
  coordinateCount: 2_000_000,
  serializedBytes: 128 * 1024 * 1024,
}

export function assertPackageLimits(stats: PackageStats, limits: PackageLimits = DEFAULT_PACKAGE_LIMITS): void {
  const labels: Record<keyof PackageStats, string> = {
    rawBytes: 'respuesta descargada',
    elementCount: 'elementos OSM',
    coordinateCount: 'coordenadas',
    serializedBytes: 'paquete local',
  }
  for (const key of Object.keys(limits) as Array<keyof PackageStats>) {
    if (!Number.isFinite(stats[key]) || stats[key] < 0 || stats[key] > limits[key]) {
      throw mapEngineError('limit-exceeded', `El límite de seguridad para ${labels[key]} se ha superado`)
    }
  }
}
