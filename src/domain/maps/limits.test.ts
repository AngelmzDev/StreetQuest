import { describe, expect, it } from 'vitest'
import { DEFAULT_PACKAGE_LIMITS, assertPackageLimits } from './limits'

describe('assertPackageLimits', () => {
  const safe = { rawBytes: 10, elementCount: 10, coordinateCount: 10, serializedBytes: 10 }

  it.each([
    ['rawBytes', DEFAULT_PACKAGE_LIMITS.rawBytes + 1],
    ['elementCount', DEFAULT_PACKAGE_LIMITS.elementCount + 1],
    ['coordinateCount', DEFAULT_PACKAGE_LIMITS.coordinateCount + 1],
    ['serializedBytes', DEFAULT_PACKAGE_LIMITS.serializedBytes + 1],
  ] as const)('rejects %s independently', (field, value) => {
    expect(() => assertPackageLimits({ ...safe, [field]: value })).toThrowError(expect.objectContaining({ kind: 'limit-exceeded' }))
  })

  it('accepts a package at every documented limit', () => {
    expect(() => assertPackageLimits({ ...DEFAULT_PACKAGE_LIMITS })).not.toThrow()
  })
})
