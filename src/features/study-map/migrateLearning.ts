import type { MunicipalityPackage } from '../../domain/maps/types'
import { createProgressBackup, restoreProgressBackup } from './progressBackup'
import { validEntry } from './learningProgress'
import { mapEngineError } from '../../domain/maps/types'

export function stageLearningMigration(previous: MunicipalityPackage, replacement: MunicipalityPackage): () => void {
  const suffixes = ['guess', 'locate', 'guess:continuous', 'locate:continuous']
  const keys = [
    `streetquest:learning:v1:${replacement.id}:guess`,
    `streetquest:learning:v1:${replacement.id}:locate`,
    ...suffixes.map((suffix) => `streetquest:streak:${replacement.id}:${suffix}`),
  ]
  // Read directly first so storage access failures cannot masquerade as an empty history.
  for (const id of [previous.id, replacement.id]) {
    localStorage.getItem(`streetquest:learning:v1:${id}:guess`)
    localStorage.getItem(`streetquest:learning:v1:${id}:locate`)
    for (const suffix of suffixes) localStorage.getItem(`streetquest:streak:${id}:${suffix}`)
  }
  const before = keys.map((key) => [key, localStorage.getItem(key)] as const)
  const old = createProgressBackup(previous.id)
  const next = createProgressBackup(replacement.id)
  const matched = new Map(replacement.streets.map((street) => [street.normalizedName, street.id]))
  for (const mode of ['guess', 'locate'] as const) {
    for (const street of previous.streets) {
      const id = matched.get(street.normalizedName)
      const source = old[mode][street.id]
      if (!id || !source) continue
      const target = next[mode][id]
      const latest = target && target.lastSeen > source.lastSeen ? target : source
      const merged = {
        attempts: source.attempts + (target?.attempts ?? 0),
        correct: source.correct + (target?.correct ?? 0),
        consecutive: latest.consecutive,
        lastSeen: latest.lastSeen,
      }
      if (!validEntry(merged)) throw mapEngineError('storage', 'No se pudo migrar el historial de calles.')
      next[mode][id] = merged
    }
  }
  next.records = next.records.map((record, index) => Math.max(record, old.records[index]!))
  restoreProgressBackup(next, replacement.id)
  return () => {
    for (const [key] of before) localStorage.removeItem(key)
    for (const [key, value] of before) if (value !== null) localStorage.setItem(key, value)
  }
}
