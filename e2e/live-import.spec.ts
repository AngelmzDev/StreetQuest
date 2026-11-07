import { expect, test } from '@playwright/test'

for (const municipality of ['Colmenarejo', 'Valdemaqueda', 'Brunete']) {
test(`downloads real ${municipality} and reopens it offline`, async ({ page, context }, testInfo) => {
  test.skip(process.env.STREETQUEST_LIVE !== '1', 'Opt-in public service integration')
  test.setTimeout(180_000)
  const transport: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') transport.push(message.text())
  })
  page.on('requestfailed', (request) => transport.push(`${request.url().split('?')[0]} ${request.failure()?.errorText}`))
  page.on('response', (response) => {
    if (!response.ok()) transport.push(`${response.status()} ${response.url().split('?')[0]}`)
  })
  try {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Municipio', exact: true }).fill(municipality)
    await page.getByRole('button', { name: /buscar municipio/i }).click()
    const open = page.getByRole('button', { name: `Abrir ${municipality}`, exact: true })
    const error = page.locator('.error-message')
    await expect(open.or(error)).toBeVisible({ timeout: 150_000 })
    if (await error.isVisible()) throw new Error(await error.innerText())
    await page.getByRole('button', { name: `Abrir ${municipality}`, exact: true }).click()
    await expect(page.getByRole('heading', { name: municipality, level: 1 })).toBeVisible()
    expect(await page.locator('select option').count()).toBeGreaterThan(20)
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await context.setOffline(true)
    await page.reload()
    await page.getByRole('button', { name: `Abrir ${municipality}`, exact: true }).click()
    await expect(page.getByRole('heading', { name: municipality, level: 1 })).toBeVisible()
    expect(await page.locator('select option').count()).toBeGreaterThan(20)
  } finally {
    if (transport.length > 0) console.error(`Diagnóstico de ${municipality}:`, JSON.stringify(transport))
    await testInfo.attach('transport', { body: JSON.stringify(transport), contentType: 'application/json' })
  }
})
}
