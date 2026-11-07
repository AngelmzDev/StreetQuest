import * as Leaflet from 'leaflet'
import type { ContextFeature, MunicipalityPackage } from '../../domain/maps/types'

interface MapLike {
  fitBounds(bounds: [[number, number], [number, number]], options?: Record<string, unknown>): void
  remove(): void
}

interface FeatureLayerLike {
  feature?: { properties?: Record<string, unknown> }
  setStyle(style: Record<string, unknown>): void
  on(events: Record<string, () => void>): void
}

interface GeoJsonLayerLike {
  addTo(map: MapLike): GeoJsonLayerLike
  eachLayer(callback: (layer: FeatureLayerLike) => void): void
}

export interface LeafletFacade {
  canvas(options?: Record<string, unknown>): unknown
  map(container: HTMLElement, options: Record<string, unknown>): MapLike
  geoJSON(data: unknown, options?: Record<string, unknown>): GeoJsonLayerLike
}

const leafletFacade: LeafletFacade = {
  canvas: (options) => Leaflet.canvas(options),
  map: (container, options) => Leaflet.map(container, options as Leaflet.MapOptions),
  geoJSON: (data, options) => Leaflet.geoJSON(data as GeoJSON.GeoJsonObject, options as Leaflet.GeoJSONOptions) as unknown as GeoJsonLayerLike,
}

const normalStreetStyle = { color: '#52796f', weight: 2, opacity: 0.82 }
const selectedStreetStyle = { color: '#d05a32', weight: 6, opacity: 1 }
function streetStyle(highway: unknown) {
  if (typeof highway === 'string' && /^(motorway|trunk|primary|secondary)/.test(highway)) {
    return { color: '#a87540', weight: 4, opacity: 0.9 }
  }
  return normalStreetStyle
}

export function createStudyMap(
  container: HTMLElement,
  pkg: MunicipalityPackage,
  leaflet: LeafletFacade = leafletFacade,
  onStreetSelected?: (streetId: string, name: string) => void,
  contextKinds: ContextFeature['kind'][] = [],
): { destroy(): void; selectStreet(id: string): void; focusStreet(id: string): void; resetView(): void } {
  const renderer = leaflet.canvas({ padding: 0.35, tolerance: 6 })
  const map = leaflet.map(container, {
    renderer,
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true,
  })
  const boundaryFeature = {
    type: 'Feature',
    properties: { kind: 'municipality-boundary' },
    geometry: pkg.boundary.geometry,
  }
  leaflet.geoJSON(boundaryFeature, {
    renderer,
    style: { color: '#17352d', weight: 3, fillColor: '#e7eee9', fillOpacity: 0.55 },
  }).addTo(map)

  const context = (pkg.context ?? []).filter((item) => contextKinds.includes(item.kind))
  const colors = { building: '#bdab97', green: '#a1c49b', water: '#8cbdcf' }
  for (const kind of ['green', 'water', 'building'] as const) {
    const features = context.filter((item) => item.kind === kind).map((item) => ({
      type: 'Feature', properties: { kind }, geometry: item.geometry,
    }))
    if (features.length) leaflet.geoJSON({ type: 'FeatureCollection', features }, {
      renderer,
      interactive: false,
      style: { color: kind === 'building' ? '#897664' : colors[kind], weight: 0.7, fillColor: colors[kind], fillOpacity: 0.75 },
    }).addTo(map)
  }

  const streetFeatures = pkg.streets.flatMap((street) => street.segments.map((segment) => ({
    type: 'Feature',
    properties: { streetId: street.id, name: street.name, segmentId: segment.id, highway: segment.highway },
    geometry: { type: 'LineString', coordinates: segment.coordinates },
  })))
  const streetLayer = leaflet.geoJSON({ type: 'FeatureCollection', features: streetFeatures }, {
    renderer,
    style: (feature: { properties?: Record<string, unknown> }) => streetStyle(feature.properties?.highway),
    onEachFeature: (feature: { properties?: Record<string, unknown> }, layer: FeatureLayerLike) => {
      layer.on({
        click: () => {
          const streetId = String(feature.properties?.streetId ?? '')
          const name = String(feature.properties?.name ?? '')
          onStreetSelected?.(streetId, name)
        },
      })
    },
  }).addTo(map)

  const [west, south, east, north] = pkg.boundary.bbox
  function resetView() {
    map.fitBounds([[south, west], [north, east]], { padding: [24, 24], maxZoom: 17 })
  }
  resetView()

  function selectStreet(id: string) {
    streetLayer.eachLayer((layer) => {
      layer.setStyle(layer.feature?.properties?.streetId === id ? selectedStreetStyle : streetStyle(layer.feature?.properties?.highway))
    })
  }

  function focusStreet(id: string) {
    const street = pkg.streets.find((item) => item.id === id)
    if (!street) return
    const bounds = Leaflet.latLngBounds([])
    for (const segment of street.segments) {
      for (const [lon, lat] of segment.coordinates) bounds.extend([lat, lon])
    }
    if (bounds.isValid()) {
      map.fitBounds([[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]], {
        padding: [48, 48],
        maxZoom: 17,
      })
    }
  }

  return { destroy: () => map.remove(), selectStreet, focusStreet, resetView }
}
