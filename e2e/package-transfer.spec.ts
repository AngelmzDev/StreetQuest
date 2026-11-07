import { expect, test } from '@playwright/test'

test('exports and imports real Colmenarejo offline and renders context', async ({ page, context }, testInfo) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Explorar Colmenarejo' }).click()
  await expect(page.getByRole('heading', { name: 'Colmenarejo', level: 1 })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('radio', { name: 'Mapa detallado' })).toBeChecked()
  await page.locator('select').selectOption({ index: 1 })
  if (process.env.STREETQUEST_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.STREETQUEST_SCREENSHOTS}/app-detailed.png`, fullPage: true })
  }
  await page.getByRole('radio', { name: 'Estudio', exact: true }).check()
  await expect(page.getByRole('checkbox', { name: 'Edificios' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Adivina la calle' }).click()
  if (process.env.STREETQUEST_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.STREETQUEST_SCREENSHOTS}/app-game.png`, fullPage: true })
  }
  await page.getByRole('button', { name: 'Saltar' }).click()
  await page.getByRole('button', { name: 'Salir del juego' }).click()
  await page.getByRole('button', { name: /volver a municipios/i }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar Colmenarejo' }).click()
  const file = testInfo.outputPath('colmenarejo.json')
  await (await download).saveAs(file)
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Eliminar Colmenarejo' }).click()
  await expect(page.getByRole('button', { name: 'Abrir Colmenarejo' })).toHaveCount(0)
  await page.getByLabel('Abrir un paquete municipal (.json)').setInputFiles(file)
  await expect(page.getByText('Colmenarejo se ha importado correctamente.')).toBeVisible()
  await page.getByRole('button', { name: 'Abrir Colmenarejo' }).click()
  await expect(page.getByRole('radio', { name: 'Mapa detallado' })).toBeChecked()
})
