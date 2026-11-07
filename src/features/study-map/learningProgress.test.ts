import { beforeEach, describe, expect, it } from 'vitest'
import { readProgress, recordAttempt, reviewStreets, summarizeProgress } from './learningProgress'
import type { Street } from '../../domain/maps/types'

const streets = ['a', 'b', 'c'].map((id) => ({ id, name: id } as Street))
beforeEach(() => localStorage.clear())

describe('learning progress', () => {
  it('persists attempts and keeps modes and municipalities separate', () => {
    recordAttempt('town', 'guess', 'a', true)
    recordAttempt('town', 'guess', 'a', false)
    expect(readProgress('town', 'guess').a).toMatchObject({ attempts: 2, correct: 1, consecutive: 0 })
    expect(readProgress('town', 'locate')).toEqual({})
    expect(readProgress('other', 'guess')).toEqual({})
  })

  it('prioritizes errors before new streets and mastered streets', () => {
    for (let i = 0; i < 3; i += 1) recordAttempt('town', 'guess', 'a', true)
    recordAttempt('town', 'guess', 'c', false)
    const progress = readProgress('town', 'guess')
    expect(reviewStreets(streets, progress).map((street) => street.id)).toEqual(['c', 'b', 'a'])
    expect(summarizeProgress(streets, progress)).toEqual({ studied: 2, mastered: 1, attempts: 4, correct: 3 })
  })

  it('recovers from invalid stored data', () => {
    localStorage.setItem('streetquest:learning:v1:town:guess', '{"a":{"attempts":-1}}')
    expect(readProgress('town', 'guess')).toEqual({})
  })
})
