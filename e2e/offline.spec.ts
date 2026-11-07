import { expect, test } from '@playwright/test'

test('reloads the app and opens cached Colmenarejo with the network disabled', async ({ page, context }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (/nominatim|overpass|tile\.openstreetmap/i.test(request.url())) externalRequests.push(request.url())
  })

  await page.goto('/')
  await page.evaluate(async () => {
    const pkg = {
      schemaVersion: 1, id: 'relation-347003',
      municipality: { osmType: 'relation', osmId: 347003, displayName: 'Colmenarejo, Madrid, España', municipalityName: 'Colmenarejo', province: 'Madrid', country: 'España', countryCode: 'es', confidence: 190, confidenceReason: 'e2e' },
      boundary: { osmType: 'relation', osmId: 347003, name: 'Colmenarejo', bbox: [-4.05, 40.48, -3.98, 40.58], geometry: { type: 'Polygon', coordinates: [[[-4.05, 40.48], [-3.98, 40.48], [-3.98, 40.58], [-4.05, 40.48]]] } },
      streets: [{ id: 'street-1', name: 'Calle Madrid', normalizedName: 'calle madrid', highwayTypes: ['residential'], segments: [{ id: '1:0', sourceWayId: 1, partIndex: 0, name: 'Calle Madrid', highway: 'residential', coordinates: [[-4.02, 40.52], [-4.01, 40.53]] }] }],
      source: { provider: 'OpenStreetMap', overpassEndpoint: 'https://overpass.test', fetchedAt: '2026-11-06T10:00:00.000Z', attribution: '© OpenStreetMap contributors' },
    }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('streetquest', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        db.createObjectStore('municipality-packages')
        db.createObjectStore('municipality-summaries').createIndex('by-fetched-at', 'fetchedAt')
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(['municipality-packages', 'municipality-summaries'], 'readwrite')
        tx.objectStore('municipality-packages').put(pkg, pkg.id)
        tx.objectStore('municipality-summaries').put({ id: pkg.id, name: 'Colmenarejo', province: 'Madrid', streetCount: 1, fetchedAt: pkg.source.fetchedAt }, pkg.id)
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect(page.getByRole('button', { name: /abrir colmenarejo/i })).toBeVisible()

  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: /abrir colmenarejo/i }).click()

  await expect(page.getByRole('heading', { name: 'Colmenarejo' })).toBeVisible()
  expect(externalRequests).toEqual([])
})
