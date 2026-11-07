import type { Street } from '../../domain/maps/types'

export type GameMode = 'guess' | 'locate'

interface Question {
  street: Street
  options: Street[]
}

export interface StreetGame {
  mode: GameMode
  questions: Question[]
  index: number
  correct: number
  streak: number
  record: number
  answered: boolean
  lastCorrect: boolean
  review: boolean
  continuous: boolean
  attempts: number
  mistakes: Street[]
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

export function startGame(mode: GameMode, streets: Street[], record = 0, reviewQueue?: Street[], continuous = false): StreetGame {
  const questions = (reviewQueue ?? shuffled(streets)).slice(0, continuous ? streets.length : 10).map((street) => ({
    street,
    options: mode === 'guess'
      ? shuffled([street, ...shuffled(streets.filter((item) => item.id !== street.id)).slice(0, 3)])
      : [],
  }))
  return { mode, questions, index: 0, correct: 0, streak: 0, record, answered: false, lastCorrect: false, review: reviewQueue !== undefined, continuous, attempts: 0, mistakes: [] }
}

export function answerGame(game: StreetGame, id?: string): StreetGame {
  const question = game.questions[game.index]
  if (!question || game.answered) return game
  const lastCorrect = question.street.id === id
  const streak = lastCorrect ? game.streak + 1 : 0
  return {
    ...game,
    answered: true,
    lastCorrect,
    correct: game.correct + Number(lastCorrect),
    streak,
    record: Math.max(game.record, streak),
    attempts: game.attempts + 1,
    mistakes: lastCorrect ? game.mistakes : [...game.mistakes, question.street],
  }
}

function recordKey(municipalityId: string, mode: GameMode, continuous: boolean): string {
  return `streetquest:streak:${municipalityId}:${mode}${continuous ? ':continuous' : ''}`
}

export function readStreakRecord(municipalityId: string, mode: GameMode, continuous = false): number {
  try {
    const value = Number(localStorage.getItem(recordKey(municipalityId, mode, continuous)))
    return Number.isSafeInteger(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function saveStreakRecord(municipalityId: string, mode: GameMode, record: number, continuous = false): boolean {
  try {
    if (record > readStreakRecord(municipalityId, mode, continuous)) {
      localStorage.setItem(recordKey(municipalityId, mode, continuous), String(record))
    }
    return true
  } catch {
    return false
  }
}
