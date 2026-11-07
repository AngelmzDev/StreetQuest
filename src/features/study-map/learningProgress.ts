import type { Street } from '../../domain/maps/types'
import type { GameMode } from './streetGame'
import { isStreetId } from '../../domain/maps/streetIdentity'

interface StreetProgress {
  attempts: number
  correct: number
  consecutive: number
  lastSeen: number
}

export type LearningProgress = Record<string, StreetProgress>

function entryFor(progress: LearningProgress, id: string) {
  return Object.hasOwn(progress, id) ? progress[id] : undefined
}

function storageKey(municipalityId: string, mode: GameMode): string {
  return `streetquest:learning:v1:${municipalityId}:${mode}`
}

export function validEntry(value: unknown): value is StreetProgress {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as StreetProgress
  return [entry.attempts, entry.correct, entry.consecutive, entry.lastSeen]
    .every((number) => Number.isSafeInteger(number) && number >= 0)
    && entry.attempts > 0 && entry.correct <= entry.attempts && entry.consecutive <= entry.correct
}

export function readProgress(municipalityId: string, mode: GameMode): LearningProgress {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey(municipalityId, mode)) ?? '{}')
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {}
    return Object.fromEntries(Object.entries(stored).filter(([id, value]) => isStreetId(id) && validEntry(value)))
  } catch {
    return {}
  }
}

export function recordAttempt(municipalityId: string, mode: GameMode, streetId: string, correct: boolean): boolean {
  if (!isStreetId(streetId)) return false
  const progress = readProgress(municipalityId, mode)
  const previous = entryFor(progress, streetId)
  progress[streetId] = {
    attempts: (previous?.attempts ?? 0) + 1,
    correct: (previous?.correct ?? 0) + Number(correct),
    consecutive: correct ? (previous?.consecutive ?? 0) + 1 : 0,
    lastSeen: Date.now(),
  }
  try {
    localStorage.setItem(storageKey(municipalityId, mode), JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}

export function reviewStreets(streets: Street[], progress: LearningProgress): Street[] {
  const priority = (id: string) => {
    const entry = entryFor(progress, id)
    if (!entry) return 1
    return entry.consecutive < 3 ? 0 : 2
  }
  return [...streets].sort((left, right) =>
    priority(left.id) - priority(right.id)
    || (entryFor(progress, left.id)?.lastSeen ?? 0) - (entryFor(progress, right.id)?.lastSeen ?? 0)
    || left.name.localeCompare(right.name, 'es'))
}

export function summarizeProgress(streets: Street[], progress: LearningProgress) {
  const entries = streets.map((street) => entryFor(progress, street.id)).filter((entry) => entry !== undefined)
  return {
    studied: entries.length,
    mastered: entries.filter((entry) => entry.consecutive >= 3).length,
    attempts: entries.reduce((total, entry) => total + entry.attempts, 0),
    correct: entries.reduce((total, entry) => total + entry.correct, 0),
  }
}
