import { expect, test } from '@playwright/test'

test('downloads real Colmenarejo and reopens it offline', async ({ page, context }) => {
  test.skip(process.env.STREETQUEST_LIVE !== '1', 'Opt-in public service integration')
  test.setTimeout(180_000)
  await page.goto('/')
  await page.getByRole('button', { name: /buscar municipio/i }).click()
  await expect(page.getByRole('button', { name: /abrir colmenarejo/i })).toBeVisible({ timeout: 150_000 })
  await page.getByRole('button', { name: /abrir colmenarejo/i }).click()
  expect(await page.locator('select option').count()).toBeGreaterThan(20)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: /abrir colmenarejo/i }).click()
  await expect(page.getByRole('heading', { name: 'Colmenarejo', level: 1 })).toBeVisible()
  expect(await page.locator('select option').count()).toBeGreaterThan(20)
})
