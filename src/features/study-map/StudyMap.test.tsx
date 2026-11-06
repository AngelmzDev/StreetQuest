import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MunicipalityPackage, StreetSegment } from '../../domain/maps/types'

vi.mock('./leafletAdapter', () => ({ createStudyMap: vi.fn(() => ({ destroy: vi.fn(), selectStreet: vi.fn() })) }))

import { StudyMap } from './StudyMap'

function packageFixture(segmentCount = 1): MunicipalityPackage {
  const segments: StreetSegment[] = Array.from({ length: segmentCount }, (_, index) => ({
    id: `${index}:0`, sourceWayId: index, partIndex: 0, name: 'Calle Uno', highway: 'residential', coordinates: [[0, 0], [1, 1]],
  }))
  return {
    schemaVersion: 1, id: 'relation-1',
    municipality: { osmType: 'relation', osmId: 1, displayName: 'Villa', municipalityName: 'Villa', country: 'España', countryCode: 'es', confidence: 1, confidenceReason: 'test' },
    boundary: { osmType: 'relation', osmId: 1, name: 'Villa', bbox: [0, 0, 1, 1], geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
    streets: [{ id: 'street-1', name: 'Calle Uno', normalizedName: 'calle uno', highwayTypes: ['residential'], segments }],
    source: { provider: 'OpenStreetMap', overpassEndpoint: 'test', fetchedAt: '2026-11-06T10:00:00.000Z', attribution: '© OpenStreetMap contributors' },
  }
}

describe('StudyMap', () => {
  it('shows municipality context, attribution, and back navigation', () => {
    const onBack = vi.fn()
    render(<StudyMap municipality={packageFixture()} onBack={onBack} />)

    expect(screen.getByRole('heading', { name: 'Villa' })).toBeInTheDocument()
    expect(screen.getByText('© OpenStreetMap contributors')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /volver/i }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('reveals a selected street name without persistent map labels', () => {
    render(<StudyMap municipality={packageFixture()} onBack={() => undefined} />)

    fireEvent.change(screen.getByRole('combobox', { name: /seleccionar calle/i }), { target: { value: 'street-1' } })
    expect(screen.getByText('Calle Uno', { selector: 'strong' })).toBeInTheDocument()
  })

  it('renders 20,000 segments through one imperative map host, not React nodes', () => {
    const { container } = render(<StudyMap municipality={packageFixture(20_000)} onBack={() => undefined} />)

    expect(container.querySelectorAll('[data-map-host]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(0)
  })
})
