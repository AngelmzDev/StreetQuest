import { useState } from 'react'
import type { MunicipalityStore } from '../../infrastructure/storage/municipalityStore'
import { readPackageFile } from './packageTransfer'

export function MunicipalityTransferPanel({ store, disabled, onSaved, onBusy }: {
  store: MunicipalityStore
  disabled: boolean
  onSaved(): Promise<void>
  onBusy(busy: boolean): void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  return <section className="search-card" aria-label="Importar mapa local">
    <label htmlFor="map-package">Abrir un paquete municipal (.json)</label>
    <p>Importa un mapa compartido o una copia guardada. Funciona sin conexión.</p>
    <input id="map-package" type="file" accept=".json,application/json" disabled={disabled || busy} onChange={async (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      setBusy(true)
      onBusy(true)
      setMessage('')
      try {
        const pkg = await readPackageFile(file)
        const previous = await store.get(pkg.id)
        if (previous && !window.confirm(`¿Sustituir la copia local de ${pkg.municipality.municipalityName}?`)) return
        await store.replaceAtomically(pkg)
        await onSaved()
        setMessage(`${pkg.municipality.municipalityName} se ha importado correctamente.`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo importar el mapa.')
      } finally {
        setBusy(false)
        onBusy(false)
      }
    }} />
    {message && <p role="status">{message}</p>}
  </section>
}
