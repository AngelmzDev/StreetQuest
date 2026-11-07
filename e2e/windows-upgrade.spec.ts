import { _electron as electron, expect, test } from '@playwright/test'

test('upgrades an older Windows profile without losing its maps or learning', async ({ browserName }, testInfo) => {
  const previous = process.env.STREETQUEST_PREVIOUS_EXE
  const current = process.env.STREETQUEST_WINDOWS_EXE
  test.skip(!previous || !current || browserName !== 'chromium', 'Requires both packaged Windows versions')
  test.setTimeout(90_000)
  const args = [`--user-data-dir=${testInfo.outputPath('upgrade-profile')}`]
  const oldApp = await electron.launch({ executablePath: previous, args })
  try {
    const page = await oldApp.firstWindow()
    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Explorar Colmenarejo' }).click()
    await page.getByRole('button', { name: 'Adivina la calle' }).click()
    await page.getByRole('button', { name: 'Saltar' }).click()
    await page.getByRole('button', { name: 'Salir del juego' }).click()
    await expect(page.getByRole('region', { name: 'Repaso inteligente' })).toContainText('1 de')
  } finally {
    await oldApp.close()
  }
  const newApp = await electron.launch({ executablePath: current, args })
  try {
    const page = await newApp.firstWindow()
    await page.context().setOffline(true)
    await expect(page.getByRole('button', { name: 'Abrir Colmenarejo' })).toBeVisible()
    await page.getByRole('button', { name: 'Explorar Colmenarejo' }).click()
    await expect(page.getByRole('radio', { name: 'Mapa detallado' })).toBeChecked({ timeout: 20_000 })
    await expect(page.getByRole('region', { name: 'Repaso inteligente' })).toContainText('1 de')
  } finally {
    await newApp.close()
  }
})
