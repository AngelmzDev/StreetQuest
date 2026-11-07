import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('presents StreetQuest with Madrid and no online tile layer', () => {
    const { container } = render(<App />)

    expect(screen.getByRole('heading', { name: 'StreetQuest' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /explorar madrid/i })).toBeInTheDocument()
    expect(container.querySelector('.leaflet-tile-container')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/tile\.openstreetmap|tileLayer/i)
  })
})
