import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MunicipalityPackage, StreetSegment } from '../../domain/maps/types'

vi.mock('./leafletAdapter', () => ({ createStudyMap: vi.fn(() => ({ destroy: vi.fn(), selectStreet: vi.fn(), focusStreet: vi.fn(), resetView: vi.fn() })) }))

import { StudyMap } from './StudyMap'
import { createStudyMap } from './leafletAdapter'

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
  it('scores the located street once and shows the result', () => {
    const municipality = packageFixture()
    render(<StudyMap municipality={municipality} onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Localiza la calle' }))
    expect(screen.getByText('Localiza Calle Uno en el mapa.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    const clickStreet = vi.mocked(createStudyMap).mock.lastCall?.[3]
    act(() => {
      clickStreet?.('street-1', 'Calle Uno')
      clickStreet?.('street-1', 'Calle Uno')
    })
    expect(screen.getByText(/correcto.*calle uno/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }))
    expect(screen.getByText('1 de 1 aciertos')).toBeInTheDocument()
  })

  it('resets the current streak on a skip and keeps the record when the map is reopened', () => {
    localStorage.clear()
    const municipality = packageFixture()
    municipality.streets.push({ ...municipality.streets[0]!, id: 'street-2', name: 'Calle Dos', normalizedName: 'calle dos' })
    const first = render(<StudyMap municipality={municipality} onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Localiza la calle' }))
    const clickStreet = vi.mocked(createStudyMap).mock.lastCall?.[3]
    const target = screen.getByText(/^Localiza Calle (Uno|Dos) en el mapa\.$/).textContent
    act(() => clickStreet?.(target?.includes('Uno') ? 'street-1' : 'street-2', ''))
    expect(screen.getByText('Racha actual: 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente calle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Saltar' }))
    expect(screen.getByText('Racha actual: 0')).toBeInTheDocument()
    expect(screen.getByText('Récord: 1')).toBeInTheDocument()
    first.unmount()
    render(<StudyMap municipality={municipality} onBack={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Localiza la calle' }))
    expect(screen.getByText('Récord: 1')).toBeInTheDocument()
    expect(screen.getByText('Racha actual: 0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salir del juego' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adivina la calle' }))
    expect(screen.getByText('Récord: 0')).toBeInTheDocument()
    localStorage.clear()
  })

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
