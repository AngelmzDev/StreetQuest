import { describe, expect, it } from 'vitest'
import { resolveEndpoint } from './config'

describe('resolveEndpoint', () => {
  it('uses a trimmed configured HTTPS endpoint', () => {
    expect(resolveEndpoint(' https://maps.example/api ', 'https://fallback.example')).toBe('https://maps.example/api')
  })

  it('falls back for blank or invalid endpoint values', () => {
    expect(resolveEndpoint('  ', 'https://fallback.example')).toBe('https://fallback.example')
    expect(resolveEndpoint('javascript:alert(1)', 'https://fallback.example')).toBe('https://fallback.example')
  })
})
