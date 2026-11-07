import { cp, mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { arch, platform } from 'node:process'
import console from 'node:console'
import electronPath from 'electron'
import { rcedit } from 'rcedit'

if (platform !== 'win32') throw new Error('Este script requiere Windows.')

await mkdir('release', { recursive: true })
const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const output = await mkdtemp(join('release', `StreetQuest-v${version}-win-${arch}-`))
await cp(dirname(electronPath), output, { recursive: true })
await rename(join(output, 'electron.exe'), join(output, 'StreetQuest.exe'))
await rcedit(join(output, 'StreetQuest.exe'), {
  icon: 'desktop/assets/icon.ico',
  'file-version': version,
  'product-version': version,
  'version-string': { ProductName: 'StreetQuest', FileDescription: 'StreetQuest — aprende las calles sin conexión', CompanyName: 'AngelmzDev' },
})
const bundle = join(output, 'resources', 'app')
await mkdir(bundle, { recursive: true })
await writeFile(join(bundle, 'package.json'), JSON.stringify({
  name: 'streetquest',
  productName: 'StreetQuest',
  version,
  type: 'module',
  main: 'desktop/main.mjs',
}))
await cp('desktop/main.mjs', join(bundle, 'desktop', 'main.mjs'))
await cp('desktop/assets', join(bundle, 'desktop', 'assets'), { recursive: true })
await cp('dist', join(bundle, 'dist'), { recursive: true })
await cp('LICENSE', join(bundle, 'LICENSE'))
await cp('ATTRIBUTION.md', join(bundle, 'ATTRIBUTION.md'))
await cp(join(dirname(electronPath), 'LICENSES.chromium.html'), join(output, 'LICENSES.chromium.html'))
console.log(join(output, 'StreetQuest.exe'))
