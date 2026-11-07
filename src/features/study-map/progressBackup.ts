import { readProgress, validEntry } from './learningProgress'
import { readStreakRecord } from './streetGame'
import { isStreetId } from '../../domain/maps/streetIdentity'

export function createProgressBackup(municipalityId: string) {
  return {
    format: 'streetquest-progress',
    version: 1,
    municipalityId,
    guess: readProgress(municipalityId, 'guess'),
    locate: readProgress(municipalityId, 'locate'),
    records: [
      readStreakRecord(municipalityId, 'guess'),
      readStreakRecord(municipalityId, 'locate'),
      readStreakRecord(municipalityId, 'guess', true),
      readStreakRecord(municipalityId, 'locate', true),
    ],
  }
}

export function validateProgressBackup(value: unknown, municipalityId: string): ReturnType<typeof createProgressBackup> {
  if (typeof value !== 'object' || value === null) throw new Error('La copia de progreso no es válida.')
  const backup = value as ReturnType<typeof createProgressBackup>
  if (backup.format !== 'streetquest-progress' || backup.version !== 1 || backup.municipalityId !== municipalityId) {
    throw new Error('La copia no corresponde a este municipio o su versión no es compatible.')
  }
  for (const entries of [backup.guess, backup.locate]) {
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)
      || Object.keys(entries).length > 250_000
      || !Object.entries(entries).every(([id, entry]) => isStreetId(id) && validEntry(entry))) {
      throw new Error('El historial de calles no es válido.')
    }
  }
  if (!Array.isArray(backup.records) || backup.records.length !== 4
    || !backup.records.every((record) => Number.isSafeInteger(record) && record >= 0)) {
    throw new Error('Los récords guardados no son válidos.')
  }
  return backup
}

export function restoreProgressBackup(value: unknown, municipalityId: string): void {
  const backup = validateProgressBackup(value, municipalityId)
  const writes: Array<[string, string]> = [
    [`streetquest:learning:v1:${municipalityId}:guess`, JSON.stringify(backup.guess)],
    [`streetquest:learning:v1:${municipalityId}:locate`, JSON.stringify(backup.locate)],
    ...(['guess', 'locate', 'guess:continuous', 'locate:continuous'] as const)
      .map((mode, index): [string, string] => [`streetquest:streak:${municipalityId}:${mode}`, String(backup.records[index])]),
  ]
  const previous = writes.map(([key]) => [key, localStorage.getItem(key)] as const)
  try {
    for (const [key, data] of writes) localStorage.setItem(key, data)
  } catch (error) {
    for (const [key] of writes) localStorage.removeItem(key)
    for (const [key, data] of previous) {
      if (data !== null) localStorage.setItem(key, data)
    }
    throw error
  }
}
