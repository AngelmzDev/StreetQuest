![Maqueta isométrica de un municipio con una calle destacada](docs/media/streetquest-banner.png)

# StreetQuest

**Aprende las calles de tu municipio con un mapa que puedes llevar sin conexión.**

StreetQuest muestra calles vectoriales sin etiquetas permanentes. Explora el mapa, selecciona una calle para ver su nombre o elígela en el listado para localizarla. Colmenarejo viene incluido con datos reales de OpenStreetMap y se puede abrir sin Internet desde el primer arranque en Windows.

- [Descargar y abrir en Windows](#descargar-y-abrir-en-windows)
- [Guía de uso](#guía-de-uso)
- [Desarrollo y pruebas](#desarrollo-y-pruebas)
- [Datos y licencias](#datos-y-licencias)

## Descargar y abrir en Windows

Si hay un paquete portable publicado en [GitHub Releases](https://github.com/AngelmzDev/StreetQuest/releases), descarga el ZIP para Windows x64, extráelo y abre **StreetQuest.exe**. Conserva la carpeta extraída completa junto al ejecutable. El programa guarda los mapas en el perfil local de Windows.

Puedes generar el paquete desde el código si aún no hay un ZIP publicado. Necesitas Windows, Git, Node.js 22 o posterior y pnpm 11.

```powershell
git clone --branch feat/phase-1-map-engine https://github.com/AngelmzDev/StreetQuest.git
cd StreetQuest
pnpm install --frozen-lockfile
pnpm build:windows
```

La última orden muestra la ruta del ejecutable en `release/`. La instalación de dependencias y del motor de escritorio requiere Internet. Colmenarejo y los mapas guardados se pueden usar sin conexión.

## Guía de uso

1. **Abre Colmenarejo.** Pulsa «Explorar Colmenarejo». La aplicación prepara y guarda el extracto incluido. Después puedes volver a abrirlo desde «Tus mapas sin conexión».
2. **Estudia el plano.** Desplázate y cambia el zoom. Pulsa un tramo para descubrir su nombre o selecciona una calle en la lista para resaltarla.
3. **Descarga otro municipio.** Con Internet, escribe el nombre y pulsa «Buscar municipio». Si aparecen varias coincidencias, elige la correcta. Cuando termine la descarga, abre su tarjeta.
4. **Gestiona las copias.** Desde el catálogo puedes abrir, actualizar o eliminar un mapa. Una actualización fallida conserva la copia anterior.

Esta fase busca municipios españoles con un límite administrativo compatible en OpenStreetMap. Los datos dependen de la cobertura de OpenStreetMap. El mapa incluye vías con nombre de las categorías seleccionadas para el estudio urbano. Los retos y juegos quedan para fases posteriores.

Si la búsqueda o descarga tarda demasiado, cancélala y vuelve a intentarlo más tarde. Mientras tanto puedes seguir usando Colmenarejo y los mapas guardados. En la edición web, abre primero la versión compilada con conexión para que el navegador guarde los recursos de la aplicación.

## Desarrollo y pruebas

StreetQuest usa React, TypeScript, Vite y Leaflet. Nominatim busca municipios y Overpass descarga sus límites y vías. El motor recorta los tramos al límite municipal, agrupa calles por nombre y guarda los paquetes en IndexedDB. Electron ejecuta el mismo mapa en Windows desde los recursos locales. La edición web usa un *service worker* para recargar sin conexión.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

| Comando | Qué comprueba o genera |
| --- | --- |
| `pnpm lint` | Reglas de calidad del código |
| `pnpm typecheck` | Tipos de TypeScript |
| `pnpm exec vitest run` | Pruebas unitarias y de integración |
| `pnpm build` | Versión web de producción |
| `pnpm exec playwright test e2e/offline.spec.ts` | Reapertura sin conexión en navegador |
| `pnpm build:windows` | Paquete portable para Windows |

Para probar el ejecutable empaquetado, usa PowerShell y la ruta que imprimió la compilación:

```powershell
$env:STREETQUEST_WINDOWS_EXE = (Resolve-Path 'release/<carpeta-generada>/StreetQuest.exe').Path
pnpm exec playwright test e2e/windows.spec.ts --workers=1
```

La prueba abre el mapa real de Colmenarejo con la red desactivada, selecciona una calle y comprueba que la copia persiste tras reiniciar la aplicación. La descarga desde Nominatim y Overpass se comprueba por separado con `STREETQUEST_LIVE=1` y `e2e/live-import.spec.ts`. Esa prueba depende de la disponibilidad de los servicios externos.

Para usar otros servidores compatibles, copia `.env.example` a `.env.local` y configura `VITE_NOMINATIM_ENDPOINT` y `VITE_OVERPASS_ENDPOINT` antes de compilar. El motor limita las descargas por tiempo, tamaño y cantidad de geometrías. Consulta [la arquitectura](docs/architecture.md) para más detalles.

## Datos y licencias

El código se distribuye bajo la [licencia MIT](LICENSE). El mapa incluido y los datos derivados de OpenStreetMap se distribuyen bajo [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), con atribución a [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). La portada es una ilustración inspirada en Colmenarejo. Consulta [la atribución de datos](ATTRIBUTION.md) para conocer la procedencia del extracto.
