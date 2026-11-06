# Arquitectura de StreetQuest — fase 1

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

El Service Worker conserva únicamente el shell de la aplicación. Las respuestas externas no entran en la caché HTTP del worker; los paquetes normalizados viven en IndexedDB.

## Límites de los módulos

- `src/domain/maps`: funciones puras y tipos propios. No depende de React, Leaflet, HTTP o IndexedDB.
- `src/infrastructure/osm`: construcción de consultas, transporte limitado y adaptación de payloads externos.
- `src/infrastructure/storage`: contrato IndexedDB versionado y atómico.
- `src/features/municipalities`: casos de uso de descubrimiento/importación y estados de interfaz.
- `src/features/study-map`: adaptador imperativo Leaflet Canvas y ciclo de vida React mínimo.
- `src/app`: composición de servicios, navegación entre catálogo y estudio, y registro PWA.

## Decisiones relevantes

### Límites municipales

`admin_level=8` mejora la puntuación en España, pero no es un filtro obligatorio. Los empates requieren selección humana. Se conservan polígonos separados y anillos interiores; las geometrías vacías, abiertas, no finitas o implausibles se rechazan.

### Calles

Se incluyen vías públicas con nombre de las clases documentadas en `queries.ts`; se excluyen senderos, carriles técnicos y vías sin nombre. Cada way OSM conserva `sourceWayId`. Si el recorte produce varias partes, reciben IDs `<wayId>:<partIndex>` y se agrupan por nombre Unicode normalizado.

### Fallos y actualización

Los transportes distinguen cancelación, timeout, red, rate limit, JSON inválido y exceso de tamaño. Solo se reintentan una vez los fallos marcados como transitorios. Una actualización reutiliza la relación conocida; si desaparece, repite el descubrimiento. La versión anterior permanece disponible hasta que la nueva transacción finaliza.

## Pruebas

La suite usa fixtures locales y `fake-indexeddb`; no depende de Nominatim u Overpass activos. Playwright construye el PWA, carga y siembra IndexedDB, desconecta el contexto del navegador, recarga y abre Colmenarejo para demostrar el recorrido offline completo.
