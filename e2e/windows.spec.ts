import { _electron as electron, expect, test } from '@playwright/test'

test('Windows executable opens real Colmenarejo offline and keeps it after restart', async ({ browserName }, testInfo) => {
  const executablePath = process.env.STREETQUEST_WINDOWS_EXE
  test.skip(!executablePath || browserName !== 'chromium', 'Requires a packaged Windows executable and Chromium')
  test.setTimeout(60_000)
  const launch = () => electron.launch({
    executablePath,
    args: [`--user-data-dir=${testInfo.outputPath('profile')}`],
  })

  const first = await launch()
  try {
    const page = await first.firstWindow()
    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Explorar Colmenarejo' }).click()
    await expect(page.getByRole('heading', { name: 'Colmenarejo', level: 1 })).toBeVisible()
    expect(await page.locator('select option').count()).toBeGreaterThan(100)
    await page.locator('select').selectOption({ index: 1 })
    await expect(page.locator('.leaflet-overlay-pane canvas')).toBeVisible()
  } finally {
    await first.close()
  }

  const second = await launch()
  try {
    const page = await second.firstWindow()
    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Abrir Colmenarejo' }).click()
    await expect(page.getByRole('heading', { name: 'Colmenarejo', level: 1 })).toBeVisible()
    expect(await page.locator('select option').count()).toBeGreaterThan(100)
  } finally {
    await second.close()
  }
})
