import { lazy, Suspense, useState } from 'react'
import './styles.css'
import type { MunicipalityPackage } from '../domain/maps/types'
import { createMunicipalityImporter } from '../features/municipalities/importMunicipality'
import { openBundledMadrid } from '../features/municipalities/madrid'
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
      setSelected(await openBundledMadrid(services.store))
    } catch (error) {
      console.error('StreetQuest: no se pudo abrir el mapa incluido', error)
      setOpenError('No se pudo abrir el mapa incluido de Madrid.')
    } finally {
      setOpeningDemo(false)
    }
  }

  if (selected) return <Suspense fallback={<p role="status">Preparando el mapa…</p>}><StudyMap municipality={selected} onBack={() => setSelected(null)} /></Suspense>

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="streetquest-title">
        <div className="hero-content">
          <span className="hero-badge">EL MAPA ES TU TABLERO</span>
          <p className="eyebrow">Aprende las calles jugando</p>
          <h1 id="streetquest-title">StreetQuest<span className="title-dot" aria-hidden="true">.</span></h1>
          <p className="hero-copy">Explora tu municipio, pon a prueba tu memoria y reconoce cada calle. Descarga el mapa una vez y sigue practicando sin conexión.</p>
          <div className="hero-actions">
            <button type="button" disabled={openingDemo} onClick={() => void openDemo()}>Explorar Madrid <span aria-hidden="true">↗</span></button>
            <a href="#municipality-home-title">Buscar otro municipio <span aria-hidden="true">↓</span></a>
          </div>
          <p className="hero-note">Gratis · Código abierto · Sin registro</p>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="map-stage">
            <div className="map-grid" />
            <div className="map-route route-one" /><div className="map-route route-two" />
            <span className="map-pin pin-one">●</span><span className="map-pin pin-two">●</span>
            <span className="map-label label-one">PLAZA MAYOR</span>
            <span className="map-label label-two">CALLE MADRID</span>
            <div className="map-question"><span>01 / 05</span><strong>¿Reconoces esta calle?</strong><small>Juega para descubrirla</small></div>
          </div>
        </div>
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
