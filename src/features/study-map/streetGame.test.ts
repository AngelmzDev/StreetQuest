import { describe, expect, it } from 'vitest'
import { answerGame, startGame } from './streetGame'
import type { Street } from '../../domain/maps/types'

const streets = Array.from({ length: 15 }, (_, index) => ({
  id: `street-${index}`, name: `Calle ${index}`,
} as Street))
describe('game sessions', () => {
  it('uses each street once in continuous mode and counts only one answer', () => {
    const game = startGame('guess', streets, 0, undefined, true)
    expect(game.questions).toHaveLength(15)
    expect(new Set(game.questions.map((question) => question.street.id)).size).toBe(15)
    const answered = answerGame(game, game.questions[0]!.street.id)
    expect(answerGame(answered, game.questions[0]!.street.id)).toBe(answered)
    expect(answered.streak).toBe(1)
    expect(answered.attempts).toBe(1)
  })
  it('preserves review priority and records skipped streets as mistakes', () => {
    const game = startGame('locate', streets, 0, [streets[2]!, streets[0]!])
    expect(game.questions[0]?.street.id).toBe('street-2')
    expect(answerGame(game).mistakes).toEqual([streets[2]])
    expect(startGame('guess', streets).questions).toHaveLength(10)
  })
})
