import { useEffect, useRef, useState } from 'react'
import type { MunicipalityPackage } from '../../domain/maps/types'
import { createStudyMap } from './leafletAdapter'

export function StudyMap({ municipality, onBack }: { municipality: MunicipalityPackage; onBack(): void }) {
  const host = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof createStudyMap> | null>(null)
  const [selectedStreetId, setSelectedStreetId] = useState('')

  useEffect(() => {
    if (!host.current) return
    controller.current = createStudyMap(host.current, municipality, undefined, (streetId) => setSelectedStreetId(streetId))
    return () => {
      controller.current?.destroy()
      controller.current = null
    }
  }, [municipality])

  const selectedStreet = municipality.streets.find((street) => street.id === selectedStreetId)

  return (
    <section className="study-view" aria-labelledby="study-map-title">
      <header className="study-header">
        <button type="button" className="secondary" onClick={onBack}>← Volver a municipios</button>
        <div>
          <p className="eyebrow">Modo estudio · sin etiquetas</p>
          <h1 id="study-map-title">{municipality.municipality.municipalityName}</h1>
        </div>
        <label className="street-picker">
          Seleccionar calle
          <select value={selectedStreetId} onChange={(event) => {
            const id = event.target.value
            setSelectedStreetId(id)
            controller.current?.selectStreet(id)
          }}>
            <option value="">Ninguna</option>
            {municipality.streets.map((street) => <option key={street.id} value={street.id}>{street.name}</option>)}
          </select>
        </label>
      </header>
      <div ref={host} data-map-host className="study-map" aria-label={`Mapa vectorial de ${municipality.municipality.municipalityName}`} />
      <footer className="study-footer">
        <strong>{selectedStreet?.name ?? 'Selecciona una calle para identificarla'}</strong>
        <span>{municipality.source.attribution}</span>
      </footer>
    </section>
  )
}
