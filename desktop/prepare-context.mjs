import { readFile, writeFile } from 'node:fs/promises'
import console from 'node:console'
import osmtogeojson from 'osmtogeojson'
import { parseContextGeometry } from '../src/domain/maps/contextGeometry.ts'

const snapshot = JSON.parse(await readFile('public/colmenarejo-osm.json', 'utf8'))
const boundary = osmtogeojson(snapshot.boundary).features.find((item) => item.id === 'relation/347003')
if (!boundary) throw new Error('No se encontró el límite de Colmenarejo.')
console.time('Prepare context')
snapshot.preparedContext = parseContextGeometry(snapshot.context, { geometry: boundary.geometry })
console.timeEnd('Prepare context')
console.log(`Prepared ${snapshot.preparedContext.length} context features`)
delete snapshot.context
await writeFile('public/colmenarejo-osm.json', JSON.stringify(snapshot))
