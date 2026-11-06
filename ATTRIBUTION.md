# Atribución de OpenStreetMap

StreetQuest utiliza datos de OpenStreetMap obtenidos mediante servicios compatibles con Nominatim y Overpass.

El archivo `public/colmenarejo-osm.json` contiene un extracto de OpenStreetMap
distribuido bajo ODbL 1.0. Incluye la relación 347003 y vías con nombre
de su entorno obtenidas de la API de OpenStreetMap. El campo `capturedAt`
registra la fecha de captura. El script `desktop/capture-colmenarejo.ps1`
documenta cómo se generó el extracto.

## Aviso visible

La aplicación muestra `© OpenStreetMap contributors` en el catálogo y en cada mapa de estudio, incluso cuando no existe una capa de teselas.

## Licencia de los datos

Los datos de OpenStreetMap están disponibles bajo la [Open Database License 1.0 (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). Consulta también la [página oficial de copyright y atribución de OpenStreetMap](https://www.openstreetmap.org/copyright).

StreetQuest transforma los datos al:

- seleccionar límites administrativos y vías con nombre;
- reconstruir polígonos y multipolígonos;
- recortar tramos contra el límite municipal;
- agrupar tramos por un nombre normalizado;
- almacenar el resultado en IndexedDB.

Los paquetes municipales almacenados son bases de datos derivadas de OpenStreetMap y no quedan cubiertos por la licencia MIT del código. Si redistribuyes públicamente estos paquetes o una base derivada, debes evaluar y cumplir las obligaciones de atribución, aviso de licencia y share-alike de ODbL.

## Servicios

Los endpoints públicos tienen capacidad compartida y políticas propias. StreetQuest limita y permite cancelar sus consultas, no realiza autocompletado y recomienda instancias propias para despliegues con tráfico sostenido.
