import { useState } from 'react'
import { downloadJson } from '../municipalities/packageTransfer'
import { createProgressBackup, restoreProgressBackup, validateProgressBackup } from './progressBackup'

export function ProgressTransfer({ municipalityId, onRestored, onBusy }: { municipalityId: string; onRestored(): void; onBusy(value: boolean): void }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <details className="progress-transfer">
    <summary>Copias de seguridad del progreso</summary>
    <p>Guarda el historial y los récords de este municipio para restaurarlos en otro equipo.</p>
    <button type="button" className="secondary" disabled={busy} onClick={() => {
      try {
        downloadJson(createProgressBackup(municipalityId), `streetquest-progreso-${municipalityId}.json`)
        setMessage('Copia de progreso preparada.')
      } catch {
        setMessage('No se pudo preparar la copia de progreso.')
      }
    }}>Exportar progreso</button>
    <label>Restaurar progreso
      <input type="file" accept=".json,application/json" disabled={busy} onChange={async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        setBusy(true)
        onBusy(true)
        try {
          if (file.size > 16 * 1024 * 1024) throw new Error('La copia supera el límite de 16 MiB.')
          const value: unknown = JSON.parse(await file.text())
          validateProgressBackup(value, municipalityId)
          if (!window.confirm('¿Sustituir el historial y los récords de este municipio por la copia?')) return
          restoreProgressBackup(value, municipalityId)
          onRestored()
          setMessage('Progreso restaurado.')
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'No se pudo restaurar el progreso.')
        } finally {
          setBusy(false)
          onBusy(false)
        }
      }} />
    </label>
    {message && <p role="status">{message}</p>}
  </details>
}
