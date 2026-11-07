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
    await page.getByRole('button', { name: 'Adivina la calle' }).click()
    await expect(page.getByText('¿Cómo se llama la calle resaltada?')).toBeVisible()
    await expect(page.getByRole('status', { name: 'Marcador' })).toHaveText(/Puntuación: 0.*Racha actual: 0.*Récord: 0/)
    await expect(page.getByRole('combobox')).toHaveCount(0)
    for (let index = 1; index <= 10; index += 1) {
      await expect(page.getByText(`Pregunta ${index} de 10 · 0 aciertos`)).toBeVisible()
      await page.getByRole('button', { name: 'Saltar' }).click()
      await page.getByRole('button', { name: index === 10 ? 'Ver resultado' : 'Siguiente calle' }).click()
    }
    await expect(page.getByText('0 de 10 aciertos')).toBeVisible()
    await page.getByRole('button', { name: 'Volver a explorar' }).click()
    await page.getByRole('button', { name: 'Localiza la calle' }).click()
    await expect(page.getByText(/^Localiza .+ en el mapa\.$/)).toBeVisible()
    await page.getByRole('button', { name: 'Salir del juego' }).click()
    await expect(page.getByRole('region', { name: 'Repaso inteligente' })).toContainText('10 de')
    await page.getByRole('button', { name: 'Repasar nombres' }).click()
    await expect(page.getByText('Repaso inteligente', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Salir del juego' }).click()
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
    await expect(page.getByRole('region', { name: 'Repaso inteligente' })).toContainText('10 de')
  } finally {
    await second.close()
  }
})
