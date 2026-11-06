import { cp, mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { arch, platform } from 'node:process'
import console from 'node:console'
import electronPath from 'electron'

if (platform !== 'win32') throw new Error('Este script requiere Windows.')

await mkdir('release', { recursive: true })
const output = await mkdtemp(join('release', `StreetQuest-win-${arch}-`))
await cp(dirname(electronPath), output, { recursive: true })
await rename(join(output, 'electron.exe'), join(output, 'StreetQuest.exe'))
const bundle = join(output, 'resources', 'app')
await mkdir(bundle, { recursive: true })
await writeFile(join(bundle, 'package.json'), JSON.stringify({
  name: 'streetquest',
  productName: 'StreetQuest',
  type: 'module',
  main: 'desktop/main.mjs',
}))
await cp('desktop/main.mjs', join(bundle, 'desktop', 'main.mjs'))
await cp('dist', join(bundle, 'dist'), { recursive: true })
await cp('LICENSE', join(bundle, 'LICENSE'))
await cp('ATTRIBUTION.md', join(bundle, 'ATTRIBUTION.md'))
console.log(join(output, 'StreetQuest.exe'))
