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
  answered: boolean
  lastCorrect: boolean
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

export function startGame(mode: GameMode, streets: Street[]): StreetGame {
  const questions = shuffled(streets).slice(0, 10).map((street) => ({
    street,
    options: mode === 'guess'
      ? shuffled([street, ...shuffled(streets.filter((item) => item.id !== street.id)).slice(0, 3)])
      : [],
  }))
  return { mode, questions, index: 0, correct: 0, answered: false, lastCorrect: false }
}

export function answerGame(game: StreetGame, id?: string): StreetGame {
  const question = game.questions[game.index]
  if (!question || game.answered) return game
  const lastCorrect = question.street.id === id
  return { ...game, answered: true, lastCorrect, correct: game.correct + Number(lastCorrect) }
}
