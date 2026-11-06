import { describe, expect, it, vi } from 'vitest'
import { createNominatimClient } from './nominatimClient'
import { createOverpassClient } from './overpassClient'

describe('Nominatim client', () => {
  it('searches Spain only on an explicit call and maps complete candidates', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{
      osm_type: 'relation', osm_id: 123, display_name: 'Colmenarejo, Comunidad de Madrid, España',
      name: 'Colmenarejo', category: 'boundary', type: 'administrative', addresstype: 'town',
      boundingbox: ['40.52', '40.59', '-4.05', '-3.96'],
      address: { town: 'Colmenarejo', province: 'Comunidad de Madrid', state: 'Comunidad de Madrid', country: 'España', country_code: 'es' },
      extratags: { admin_level: '8' },
    }]), { status: 200, headers: { 'content-type': 'application/json' } }))
    const client = createNominatimClient(fetchImpl)

    expect(fetchImpl).not.toHaveBeenCalled()
    const results = await client.searchMunicipalities('Colmenarejo', { countryCode: 'es', signal: new AbortController().signal })

    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(url.searchParams.get('q')).toBe('Colmenarejo')
    expect(url.searchParams.get('countrycodes')).toBe('es')
    expect(url.searchParams.get('addressdetails')).toBe('1')
    expect(results[0]).toMatchObject({ osmId: 123, municipalityName: 'Colmenarejo', adminLevel: 8, countryCode: 'es' })
  })

  it('applies an internal deadline when the caller does not cancel', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const client = createNominatimClient(fetchImpl, 'https://nominatim.test/search', 5)
    await expect(client.searchMunicipalities('Colmenarejo', { countryCode: 'es', signal: new AbortController().signal }))
      .rejects.toMatchObject({ kind: 'timeout', retryable: true })
  })
})

describe('Overpass client', () => {
  it('propagates caller cancellation as an aborted error', async () => {
    const controller = new AbortController()
    controller.abort()
    const client = createOverpassClient(vi.fn<typeof fetch>())

    await expect(client.executeOverpass('[out:json];', { signal: controller.signal, timeoutMs: 100, maxBytes: 1000 }))
      .rejects.toMatchObject({ kind: 'aborted', retryable: false })
  })

  it('classifies its own deadline as a retryable timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const client = createOverpassClient(fetchImpl)
    await expect(client.executeOverpass('query', { signal: new AbortController().signal, timeoutMs: 5, maxBytes: 1000 }))
      .rejects.toMatchObject({ kind: 'timeout', retryable: true })
  })

  it('classifies HTTP 429 without retrying inside the transport', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('slow down', { status: 429 }))
    const client = createOverpassClient(fetchImpl)

    await expect(client.executeOverpass('query', { signal: new AbortController().signal, timeoutMs: 100, maxBytes: 1000 }))
      .rejects.toMatchObject({ kind: 'rate-limited', retryable: false })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed JSON as an invalid response', async () => {
    const client = createOverpassClient(vi.fn<typeof fetch>().mockResolvedValue(new Response('{nope', { status: 200 })))

    await expect(client.executeOverpass('query', { signal: new AbortController().signal, timeoutMs: 100, maxBytes: 1000 }))
      .rejects.toMatchObject({ kind: 'invalid-response', retryable: false })
  })

  it('rejects HTTP 200 Overpass runtime remarks instead of accepting partial elements', async () => {
    const payload = { remark: 'runtime error: Query timed out in query', elements: [{ type: 'way', id: 1 }] }
    const client = createOverpassClient(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })))

    await expect(client.executeOverpass('query', { signal: new AbortController().signal, timeoutMs: 100, maxBytes: 10_000 }))
      .rejects.toMatchObject({ kind: 'timeout', retryable: true })
  })

  it('classifies non-timeout Overpass runtime failures as retryable partial responses', async () => {
    const payload = { remark: 'runtime error: out of memory', elements: [] }
    const client = createOverpassClient(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })))
    await expect(client.executeOverpass('query', { signal: new AbortController().signal, timeoutMs: 100, maxBytes: 10_000 }))
      .rejects.toMatchObject({ kind: 'invalid-response', retryable: true })
  })

  it('aborts before reading a response declared above the byte limit', async () => {
    const client = createOverpassClient(vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-length': '1001' },
    })))

    await expect(client.executeOverpass('query', { signal: new AbortController().signal, timeoutMs: 100, maxBytes: 1000 }))
      .rejects.toMatchObject({ kind: 'limit-exceeded', retryable: false })
  })

  it('cancels a streaming body as soon as the byte limit is crossed', async () => {
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        if (pulls <= 10) controller.enqueue(new TextEncoder().encode('1234'))
        else controller.close()
      },
    })
    const client = createOverpassClient(vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200 })))

    await expect(client.executeOverpass('query', { signal: new AbortController().signal, timeoutMs: 100, maxBytes: 5 }))
      .rejects.toMatchObject({ kind: 'limit-exceeded' })
    expect(pulls).toBeLessThan(10)
  })
})
