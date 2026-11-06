import { mapEngineError } from '../../domain/maps/types'
import { OVERPASS_ENDPOINT } from './config'

export interface OverpassClient {
  executeOverpass(query: string, options: { signal: AbortSignal; timeoutMs: number; maxBytes: number }): Promise<unknown>
}

function isMapEngineError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'kind' in error && 'retryable' in error
}

function rejectRuntimeRemark(payload: unknown): void {
  if (typeof payload !== 'object' || payload === null || !('remark' in payload) || typeof payload.remark !== 'string') return
  if (/timed?\s*out|timeout/i.test(payload.remark)) {
    throw mapEngineError('timeout', 'Overpass agotó el tiempo de ejecución', true, payload.remark)
  }
  throw mapEngineError('invalid-response', 'Overpass devolvió una respuesta parcial', true, payload.remark)
}

async function readLimitedBody(response: Response, maxBytes: number, controller: AbortController): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        controller.abort()
        throw mapEngineError('limit-exceeded', 'La respuesta de Overpass supera el límite de seguridad')
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

export function createOverpassClient(fetchImpl: typeof fetch = fetch, endpoint = OVERPASS_ENDPOINT): OverpassClient {
  return {
    async executeOverpass(query, options) {
      if (options.signal.aborted) throw mapEngineError('aborted', 'Descarga cancelada')
      const controller = new AbortController()
      let timedOut = false
      const onCallerAbort = () => controller.abort(options.signal.reason)
      options.signal.addEventListener('abort', onCallerAbort, { once: true })
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, options.timeoutMs)

      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          body: new URLSearchParams({ data: query }),
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          signal: controller.signal,
        })
        if (response.status === 429) throw mapEngineError('rate-limited', 'Overpass ha limitado temporalmente las consultas')
        if (!response.ok) throw mapEngineError('network', `Overpass respondió ${response.status}`, response.status >= 500)
        const declaredBytes = Number(response.headers.get('content-length'))
        if (Number.isFinite(declaredBytes) && declaredBytes > options.maxBytes) {
          throw mapEngineError('limit-exceeded', 'La respuesta de Overpass supera el límite de seguridad')
        }
        const text = await readLimitedBody(response, options.maxBytes, controller)
        let payload: unknown
        try {
          payload = JSON.parse(text) as unknown
        } catch (error) {
          throw mapEngineError('invalid-response', 'Overpass devolvió JSON no válido', false, error)
        }
        rejectRuntimeRemark(payload)
        return payload
      } catch (error) {
        if (timedOut) throw mapEngineError('timeout', 'Overpass tardó demasiado en responder', true, error)
        if (options.signal.aborted) throw mapEngineError('aborted', 'Descarga cancelada', false, error)
        if (isMapEngineError(error)) throw error
        throw mapEngineError('network', 'No se pudo consultar Overpass', true, error)
      } finally {
        clearTimeout(timeout)
        options.signal.removeEventListener('abort', onCallerAbort)
      }
    },
  }
}

export const executeOverpass = createOverpassClient().executeOverpass
