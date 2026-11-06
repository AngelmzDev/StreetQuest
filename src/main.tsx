import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import 'leaflet/dist/leaflet.css'

const root = document.getElementById('root')

if (!root) throw new Error('No se encontró el elemento raíz de StreetQuest')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
