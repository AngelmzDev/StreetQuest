import { lazy, Suspense, useState } from 'react'
import './styles.css'
import type { MunicipalityPackage } from '../domain/maps/types'
import { createMunicipalityImporter } from '../features/municipalities/importMunicipality'
import { openBundledColmenarejo } from '../features/municipalities/colmenarejo'
import { MunicipalityHome, type AppServices } from '../features/municipalities/MunicipalityHome'
import { createNominatimClient } from '../infrastructure/osm/nominatimClient'
import { createOverpassClient } from '../infrastructure/osm/overpassClient'
import { createMunicipalityStore } from '../infrastructure/storage/municipalityStore'
const StudyMap = lazy(() => import('../features/study-map/StudyMap').then((module) => ({ default: module.StudyMap })))

const store = createMunicipalityStore()
const defaultServices: AppServices = {
  store,
  importer: createMunicipalityImporter({
    store,
    nominatim: createNominatimClient(),
    overpass: createOverpassClient(),
  }),
}

export function App({ services = defaultServices }: { services?: AppServices }) {
  const [selected, setSelected] = useState<MunicipalityPackage | null>(null)
  const [openError, setOpenError] = useState('')
  const [openingDemo, setOpeningDemo] = useState(false)

  async function openDemo() {
    setOpeningDemo(true)
    setOpenError('')
    try {
      setSelected(await openBundledColmenarejo(services.store))
    } catch {
      setOpenError('No se pudo abrir el mapa incluido de Colmenarejo.')
    } finally {
      setOpeningDemo(false)
    }
  }

  if (selected) return <Suspense fallback={<p role="status">Preparando el mapa…</p>}><StudyMap municipality={selected} onBack={() => setSelected(null)} /></Suspense>

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="streetquest-title">
        <p className="eyebrow">Aprende tu municipio, calle a calle</p>
        <h1 id="streetquest-title">StreetQuest</h1>
        <p className="hero-copy">
          Descarga un municipio una vez y estudia después su mapa vectorial, incluso sin conexión.
        </p>
        <button type="button" disabled={openingDemo} onClick={() => void openDemo()}>Explorar Colmenarejo</button>
        <p className="attribution">© OpenStreetMap contributors</p>
      </section>
      <MunicipalityHome services={services} onOpenMunicipality={(id) => {
        void services.store.get(id)
          .then((pkg) => { if (pkg) setSelected(pkg); else setOpenError('El mapa guardado ya no está disponible.') })
          .catch(() => setOpenError('No se pudo abrir el mapa desde el almacenamiento local.'))
      }} />
      {openError && <p role="alert" className="error-message">{openError}</p>}
    </main>
  )
}
