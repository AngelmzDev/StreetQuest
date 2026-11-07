import { beforeEach, describe, expect, it } from 'vitest'
import { createProgressBackup, restoreProgressBackup } from './progressBackup'
import { readProgress, recordAttempt } from './learningProgress'
import { readStreakRecord, saveStreakRecord } from './streetGame'

beforeEach(() => localStorage.clear())

describe('progress backup', () => {
  it('restores attempts and both kinds of records without touching other towns', () => {
    recordAttempt('relation-1', 'guess', 'street-a', true)
    saveStreakRecord('relation-1', 'guess', 5, true)
    const backup = createProgressBackup('relation-1')
    recordAttempt('relation-2', 'guess', 'street-b', true)
    localStorage.removeItem('streetquest:learning:v1:relation-1:guess')
    restoreProgressBackup(JSON.parse(JSON.stringify(backup)), 'relation-1')
    expect(readProgress('relation-1', 'guess')['street-a']?.attempts).toBe(1)
    expect(readStreakRecord('relation-1', 'guess', true)).toBe(5)
    expect(readProgress('relation-2', 'guess')['street-b']?.attempts).toBe(1)
  })
  it('rejects invalid or wrong-municipality backups before changing data', () => {
    const backup = createProgressBackup('relation-1')
    expect(() => restoreProgressBackup(backup, 'relation-2')).toThrow()
    expect(() => restoreProgressBackup({ ...backup, records: [-1, 0, 0, 0] }, 'relation-1')).toThrow()
    expect(localStorage.length).toBe(0)
  })
})
