import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import 'leaflet/dist/leaflet.css'
import { registerSW } from 'virtual:pwa-register'
import { registerOfflineShell } from './app/offline'

registerOfflineShell(registerSW)

const root = document.getElementById('root')

if (!root) throw new Error('No se encontró el elemento raíz de StreetQuest')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
