export function resolveEndpoint(configured: string | undefined, fallback: string): string {
  const value = configured?.trim()
  if (!value) return fallback
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1' ? url.toString().replace(/\/$/, '') : fallback
  } catch {
    return fallback
  }
}

export const NOMINATIM_ENDPOINT = resolveEndpoint(import.meta.env.VITE_NOMINATIM_ENDPOINT, 'https://nominatim.openstreetmap.org/search')
export const OVERPASS_ENDPOINT = resolveEndpoint(import.meta.env.VITE_OVERPASS_ENDPOINT, 'https://overpass-api.de/api/interpreter')
export const DEFAULT_TIMEOUT_MS = 30_000
export const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024 * 1024
