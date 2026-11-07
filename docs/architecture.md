# Arquitectura de StreetQuest — versión 1.0

## Flujo de datos

```text
Formulario de municipio
  → Nominatim (descubrimiento de candidatos)
  → selección explícita cuando hay empate
  → Overpass (relación administrativa + vías permitidas)
  → validación Polygon/MultiPolygon
  → recorte y agrupación de tramos
  → paquete municipal v1
  → transacción atómica IndexedDB
  → Leaflet Canvas sin TileLayer
```

El Service Worker conserva el shell y el extracto incluido de Colmenarejo. Las respuestas externas no entran en la caché HTTP del worker. Los paquetes normalizados viven en IndexedDB. Electron sirve los archivos incluidos mediante el protocolo seguro local streetquest://bundle y conserva el mismo origen entre versiones.

## Límites de los módulos

- `src/domain/maps`: funciones puras y tipos propios. No depende de React, Leaflet, HTTP o IndexedDB.
- `src/infrastructure/osm`: construcción de consultas, transporte limitado y adaptación de payloads externos.
- `src/infrastructure/storage`: contrato IndexedDB versionado y atómico.
- `src/features/municipalities`: casos de uso de descubrimiento/importación y estados de interfaz.
- `src/features/study-map`: adaptador imperativo Leaflet Canvas y ciclo de vida React mínimo.
- `src/app`: composición de servicios, navegación entre catálogo y estudio, y registro PWA.

## Decisiones relevantes

### Límites municipales

La búsqueda se limita a España y la importación exige una relación administrativa de nivel 8. Los empates y candidatos débiles requieren selección humana. Se conservan polígonos separados y anillos interiores. Se rechazan miembros incompletos, geometrías vacías, no finitas o implausibles y reconstrucciones que pierdan miembros.

### Calles

Se incluyen vías públicas con nombre de las clases documentadas en `queries.ts`; se excluyen senderos, carriles técnicos y vías sin nombre. Cada way OSM conserva `sourceWayId`. Si el recorte produce varias partes, reciben IDs `<wayId>:<partIndex>` y se agrupan por nombre Unicode normalizado.

### Fallos y actualización

Los transportes distinguen cancelación, timeout, red, rate limit, JSON inválido y exceso de tamaño. Solo se reintentan una vez los fallos marcados como transitorios. Una actualización reutiliza la relación conocida; si desaparece, repite el descubrimiento. La versión anterior permanece disponible hasta que la nueva transacción finaliza.

## Pruebas

La suite usa fixtures locales y `fake-indexeddb`; no depende de Nominatim u Overpass activos. Playwright construye el PWA, carga y siembra IndexedDB, desconecta el contexto del navegador, recarga y abre Colmenarejo para demostrar el recorrido offline completo.

## Contexto visual y compatibilidad

Los paquetes v1 admiten un campo opcional context con polígonos de edificios, zonas verdes y agua. Los paquetes anteriores siguen siendo legibles. Las geometrías se recortan al límite municipal. Las que no pueden tocar el límite se clasifican directamente y las restantes pasan por una intersección poligonal.

Leaflet dibuja el contexto antes de las calles. Las capas de contexto no son interactivas y carecen de nombres. La vista Estudio oculta estas capas. La jerarquía de calles se representa con estilos diferentes.

## Juegos y aprendizaje

streetGame.ts gestiona las rondas, rachas y errores. learningProgress.ts registra intentos y aciertos por municipio, modo y calle. Los récords y el historial viven en localStorage bajo claves separadas por tipo de sesión. El modo continuo presenta calles sin repetir hasta fallar o agotar el municipio.

El repaso prioriza calles practicadas con menos de tres aciertos consecutivos, después calles nuevas y finalmente dominadas. En cada grupo se utiliza la antigüedad del último intento. Los respaldos validan municipio, versión y valores antes de sustituir los datos. Se conservan los identificadores de calle existentes.

## Transferencia de datos

packageTransfer.ts valida identidad OSM, límites, geometrías, calles, contexto y metadatos antes de escribir paquetes importados. Los archivos están limitados a 128 MiB. La escritura utiliza la misma transacción atómica que una descarga.

Las copias de progreso se limitan a 16 MiB y requieren confirmación antes de restaurarse. Los errores de almacenamiento se comunican en la interfaz.

## Publicación

La compilación de Windows crea una carpeta portable con Electron, la aplicación, el mapa incluido y las licencias. GitHub Actions comprueba tipos, lint, pruebas unitarias y los recorridos offline del ejecutable. Los tags v* publican el ZIP verificado y SHA256SUMS.txt tras superar esos controles.
