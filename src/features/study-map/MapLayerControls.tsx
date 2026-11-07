import type { ContextFeature } from '../../domain/maps/types'

import { CONTEXT_KINDS } from './mapTheme'

export function MapLayerControls({ available, detailed, kinds, onDetailed, onKinds }: {
  available: boolean
  detailed: boolean
  kinds: ContextFeature['kind'][]
  onDetailed(value: boolean): void
  onKinds(value: ContextFeature['kind'][]): void
}) {
  return <fieldset className="map-controls">
    <legend>Vista del mapa</legend>
    <label><input type="radio" name="map-view" checked={!detailed} onChange={() => onDetailed(false)} /> Estudio</label>
    <label><input type="radio" name="map-view" checked={detailed} disabled={!available} onChange={() => onDetailed(true)} /> Mapa detallado</label>
    {detailed && CONTEXT_KINDS.map((kind) => <label key={kind}>
      <input type="checkbox" checked={kinds.includes(kind)} onChange={(event) => onKinds(event.target.checked ? [...kinds, kind] : kinds.filter((item) => item !== kind))} />
      {{ building: 'Edificios', green: 'Zonas verdes', water: 'Agua' }[kind]}
    </label>)}
    {!available && <span>Este mapa no incluye capas de contexto.</span>}
  </fieldset>
}
