import type { BBox } from '../../domain/maps/types'

const STUDY_HIGHWAYS = [
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified',
  'residential', 'living_street', 'pedestrian', 'service',
].join('|')

export function buildBoundaryQuery(relationId: number): string {
  return `[out:json][timeout:30];relation(${relationId});out geom;`
}

export function buildStreetQuery(input: { relationId: number; bbox: BBox; mode: 'area' | 'bbox' }): string {
  const selector = `["highway"~"^(${STUDY_HIGHWAYS})$"]["name"]`
  if (input.mode === 'area') {
    return `[out:json][timeout:60];relation(${input.relationId})->.municipality;.municipality map_to_area->.searchArea;way(area.searchArea)${selector};out body geom;`
  }
  const [west, south, east, north] = input.bbox
  const box = `(${south},${west},${north},${east})`
  return `[out:json][timeout:60];(way${selector}${box};way["building"]${box};way["landuse"~"^(forest|grass|meadow|village_green)$"]${box};way["natural"~"^(water|wood|scrub|grassland)$"]${box};way["leisure"~"^(park|garden|recreation_ground)$"]${box};);out body geom;`
}
