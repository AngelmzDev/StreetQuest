import { app, BrowserWindow, net, protocol } from 'electron'
import { isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL, URL } from 'node:url'

const { Response, Headers } = globalThis

const scheme = 'streetquest'
const home = 'streetquest://bundle/'

protocol.registerSchemesAsPrivileged([
  { scheme, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

app.whenReady().then(() => {
  const dist = resolve(app.getAppPath(), 'dist')
  protocol.handle(scheme, async (request) => {
    const url = new URL(request.url)
    if (url.host !== 'bundle' || request.method !== 'GET') return new Response(null, { status: 404 })
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname.slice(1))
    } catch {
      return new Response(null, { status: 400 })
    }
    const file = resolve(dist, pathname || 'index.html')
    const target = relative(dist, file)
    if (!target || target.startsWith('..') || isAbsolute(target) || target.includes(':')) {
      return new Response(null, { status: 403 })
    }
    try {
      const response = await net.fetch(pathToFileURL(file).href)
      const headers = new Headers(response.headers)
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'none'")
      return new Response(response.body, { status: response.status, headers })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  const window = new BrowserWindow({
    title: 'StreetQuest',
    icon: resolve(app.getAppPath(), 'desktop', 'assets', 'icon.png'),
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  return window.loadURL(home)
})

app.on('window-all-closed', () => app.quit())
