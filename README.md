# StreetQuest

🗺️ Turn any town into a learning adventure. Master streets, explore maps, complete challenges, and learn your city through interactive games. Open-source &amp; free.

StreetQuest convierte los datos abiertos de un municipio en un mapa de estudio vectorial. Descarga el municipio una vez y después puedes recorrer sus calles sin conexión, sin etiquetas y sin depender de teselas en línea.

## Primera fase

Esta rama incorpora el motor municipal sobre el que se construirán los retos y juegos:

- búsqueda de municipios españoles mediante Nominatim;
- límites administrativos Polygon/MultiPolygon validados, incluidos enclaves y áreas separadas;
- descarga acotada de vías desde Overpass;
- recorte de geometrías contra el límite municipal y agrupación de tramos por nombre;
- paquetes versionados y reemplazo atómico en IndexedDB;
- catálogo local, actualización manual y funcionamiento offline;
- mapa Leaflet Canvas sin capa de teselas ni etiquetas persistentes;
- Colmenarejo como fixture y municipio inicial de demostración.

## Requisitos

- Node.js 22 o posterior.
- pnpm 11 (`corepack enable` y `corepack prepare pnpm@11.25.0 --activate` si no está disponible).
- Un navegador moderno con IndexedDB y Service Workers.

## Desarrollo

```bash
pnpm install
pnpm dev
```

La aplicación se abre en la dirección indicada por Vite. La búsqueda se ejecuta únicamente al enviar el formulario; no implementa autocompletado contra Nominatim.

Scripts disponibles:

| Comando | Uso |
| --- | --- |
| `pnpm dev` | Servidor local de desarrollo |
| `pnpm build` | Comprobación TypeScript y build PWA de producción |
| `pnpm preview` | Sirve el último build local |
| `pnpm test -- --run` | Suite unitaria y de integración |
| `pnpm test:e2e` | Prueba offline real en navegador (requiere un build previo) |
| `pnpm typecheck` | Tipos estrictos |
| `pnpm lint` | Reglas de calidad |

Verificación completa:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test -- --run
pnpm build
pnpm test:e2e
```

## Uso sin conexión

«Explorar Colmenarejo» abre el mapa incluido, obtenido de OpenStreetMap.
Está disponible desde el primer arranque de la edición Windows, sin descarga
previa. El catálogo guarda la copia en el perfil local de StreetQuest.

En Windows, ejecuta `pnpm build:windows` para generar una carpeta portable
en `release/`. Abre `StreetQuest.exe` desde esa carpeta y conserva junto al
ejecutable los archivos que se generaron con él.

1. Con conexión, busca un municipio y confirma el candidato correcto cuando exista ambigüedad.
2. StreetQuest descarga el límite y las calles, valida el paquete y lo guarda en IndexedDB.
3. Abre el municipio desde «Tus mapas sin conexión».
4. En visitas posteriores el Service Worker sirve la aplicación y el mapa usa exclusivamente las geometrías locales.

Una actualización nunca sustituye la copia anterior hasta que el nuevo paquete ha pasado todas las validaciones y se ha guardado de forma atómica. Puedes eliminar cualquier paquete desde su tarjeta.

## Configuración de servicios

Copia `.env.example` a `.env.local` para usar instancias propias:

```dotenv
VITE_NOMINATIM_ENDPOINT=https://nominatim.openstreetmap.org/search
VITE_OVERPASS_ENDPOINT=https://overpass-api.de/api/interpreter
```

Los endpoints deben usar HTTPS (se permite HTTP únicamente para `localhost`/`127.0.0.1`). Respeta las políticas de uso de cada servicio: consultas explícitas, sin autocompletado y sin descargas concurrentes agresivas. Para uso público sostenido, despliega instancias propias o un proveedor con capacidad acordada.

## Límites de seguridad

Una importación se cancela antes de persistir datos parciales cuando supera cualquiera de estos límites:

- 64 MiB por respuesta descargada;
- 250.000 elementos OSM;
- 2.000.000 de coordenadas;
- 128 MiB para el paquete serializado final.

Estos límites protegen el navegador frente a respuestas anómalas; no son límites de población o superficie del municipio.

## Datos y limitaciones

StreetQuest refleja OpenStreetMap en el momento de la descarga. Los nombres incompletos, calles ausentes, relaciones administrativas rotas o clasificaciones discutibles deben corregirse en OpenStreetMap. Las vías sin nombre y senderos/caminos no destinados al estudio urbano quedan fuera de esta fase.

Los fixtures son extractos condensados de estructuras Overpass: Colmenarejo usa la relación OSM `347003`; el fixture de enclaves es sintético y prueba topologías difíciles sin consultar servicios durante la suite.

Consulta [la arquitectura](docs/architecture.md) y [la atribución de datos](ATTRIBUTION.md) para más detalles.

## Licencias

El código de StreetQuest se distribuye bajo la licencia MIT. Los datos derivados de OpenStreetMap no se relicencian bajo MIT: permanecen sujetos a ODbL. Consulta `LICENSE` y `ATTRIBUTION.md`.
