import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { platform } from 'node:process'

const browser = await chromium.launch({ channel: platform === 'win32' ? 'msedge' : undefined })
try {
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } })
  const svg = await readFile('public/icon.svg', 'utf8')
  await page.setContent(`<style>body{margin:0}svg{width:256px;height:256px;display:block}</style>${svg}`)
  const png = await page.screenshot({ omitBackground: true })
  await mkdir('desktop/assets', { recursive: true })
  await writeFile('desktop/assets/icon.png', png)
  const header = Buffer.alloc(22)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(22, 18)
  await writeFile('desktop/assets/icon.ico', Buffer.concat([header, png]))
} finally {
  await browser.close()
}
