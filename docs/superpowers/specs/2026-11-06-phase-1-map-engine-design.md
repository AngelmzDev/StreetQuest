# StreetQuest Phase 1: Municipal Map Engine Design

## Intent

StreetQuest turns learning the streets of a municipality into a map-based study experience. Phase 1 establishes the reusable municipal data and rendering foundation, using Colmenarejo as the first verified dataset. A municipality is downloaded once while online and can then be studied completely offline without depending on online map tiles or labels.

## Goals

- Provide a React + TypeScript + Vite application with Leaflet as the interaction layer.
- Find and load any Spanish municipality from OpenStreetMap/Overpass, starting with Colmenarejo.
- Resolve municipal administrative boundaries defensively when search results are missing, duplicated, malformed, or ambiguous.
- download the selected boundary and named street geometries, clip usable geometry to the municipality, and preserve source metadata.
- Group OpenStreetMap way fragments into stable street records while retaining their individual vector segments.
- Store normalized municipality packages in IndexedDB for later offline study.
- Render a label-free study map entirely from cached vector geometry, with no online tile dependency.
- Expose loading, progress, retry, cancellation, cache age, refresh, and offline states clearly.
- Ship automated tests, documentation, licensing, OpenStreetMap attribution, and development scripts.

## Non-goals

- Games, scoring, accounts, synchronization, navigation, routing, or geocoding arbitrary addresses.
- Background synchronization or automatic cache eviction.
- Fully offline first-time acquisition of a municipality.
- Serving or generating vector-tile packages in this phase.
- Guaranteeing identical naming across municipalities where OpenStreetMap data itself is incomplete.

## Anti-goals

- Do not hide uncertainty by silently selecting an arbitrary boundary.
- Do not use an online basemap as a visual fallback during study.
- Do not flatten all street fragments into a single lossy line.
- Do not bind domain logic directly to Leaflet, Overpass response shapes, or IndexedDB APIs.
- Do not make Colmenarejo a hard-coded special case in the engine.

## Constraints

- The existing `README.md` must be preserved and expanded, not discarded.
- Runtime stack: React, TypeScript, Vite, Leaflet, OpenStreetMap/Overpass, and IndexedDB.
- Cached study mode must work without network access and without online tiles.
- Data derived from OpenStreetMap must include visible attribution and ODbL documentation.
- Overpass is a public shared service: queries must be bounded, cancellable, timeout-aware, and produce actionable failures.
- The browser remains the only required runtime for phase 1; no backend is introduced.
- The architecture must not hard-code a population or area threshold. Phase 1 supports complete Spanish municipalities through bounded downloads, chunked processing, and canvas-backed Leaflet vector rendering. Explicit safety limits protect the browser from anomalous payloads and report a clear error rather than persisting partial data.

## Approaches considered

### 1. Normalized GeoJSON-like vectors in IndexedDB — selected

Fetch the administrative boundary and road ways from Overpass, normalize them into application-owned typed records, store municipality packages in IndexedDB, and render the cached vectors through Leaflet. This is the smallest architecture that provides true offline study, transparent data, deterministic tests, and a straightforward path to multiple municipalities.

### 2. Local vector-tile packages

Pre-generate or download local vector tiles and render them from browser storage. This scales better for very large areas, but adds a tiling pipeline, tile archive management, and a second set of spatial concerns before phase 1 proves the product.

### 3. Adaptive vectors plus vector tiles

Use normalized vectors for small municipalities and tiles above a size threshold. This offers a longer-term performance path, but creates two storage and rendering engines immediately. It is deferred; phase 1 interfaces will keep data acquisition, storage, and rendering separable so it can be introduced later.

## Domain model

The application owns its domain types and does not persist raw Overpass payloads as the primary format.

- `MunicipalityCandidate`: OSM identity, display name, province/region/country context, administrative level, center/bounds when available, and a confidence/explanation field.
- `MunicipalityBoundary`: OSM relation identity plus validated polygon or multipolygon geometry and bounding box.
- `StreetSegment`: deterministic derived segment identity, source way identity, part index, coordinates, and relevant OSM metadata.
- `Street`: stable local identifier, display name, normalized comparison name, road classifications, and one or more retained segments.
- `MunicipalityPackage`: schema version, municipality metadata, boundary, streets, source timestamp, fetched timestamp, Overpass endpoint, and attribution.
- `CachedMunicipalitySummary`: lightweight catalog entry used without loading every geometry package.

Street grouping uses a conservative normalized name key: Unicode normalization, trimmed/collapsed whitespace, and case-insensitive comparison. It does not remove meaningful punctuation or expand street-type abbreviations in phase 1. Unnamed ways are excluded from the study street list but may be counted in import diagnostics.

`Street.id` is deterministic from the municipality identity and normalized name, so it survives a refresh while that name remains unchanged. A renamed street intentionally receives a new identity in phase 1; historical rename reconciliation is out of scope.

## Boundary discovery and validation

1. Search Nominatim-compatible OpenStreetMap results for municipality candidates using the municipality name and optional province context. Search is only for discovery; it is not cached as authoritative geometry.
2. Prefer administrative relations whose type and administrative level are compatible with a municipality and whose contextual address matches the requested country/province. For Spain, `admin_level=8` is preferred rather than mandatory because real OSM tagging may be incomplete; lower-confidence candidates are never selected silently.
3. When several credible results remain, show them to the user instead of guessing.
4. Fetch authoritative relation geometry and metadata from Overpass.
5. Convert relation members to polygon or multipolygon geometry, accepting disjoint rings and enclaves.
6. Validate that geometry is non-empty, finite, ring-closed, and has a usable bounding box. Normalize ring orientation when needed.
7. Reject or clearly report incomplete relations, missing outer rings, unresolvable member geometry, and implausibly large results.

Colmenarejo is a seed search/default and fixture target, not a hard-coded relation ID. Fixtures pin representative Overpass responses so tests do not depend on the live service.

## Street acquisition and grouping

After validating the boundary, issue a bounded Overpass query for named public street ways intersecting the municipality area or bounding box. Included classifications are motorway/trunk/primary/secondary/tertiary and their links, unclassified, residential, living street, and pedestrian. A named service way is included because it can represent a locally learned street. Track, path, footway, cycleway, bridleway, steps, corridor, raceway, construction, and proposed ways are excluded from phase 1 study content.

Geometry is filtered/clipped client-side against the authoritative municipal polygon so ways merely crossing a coarse bounding box do not leak unrelated segments into the package. When clipping one OSM way produces multiple disconnected parts, each part becomes a separate derived `StreetSegment` with ID `<wayId>:<partIndex>` and the same `sourceWayId`; deduplication happens before clipping by source way ID.

Each OSM way remains a `StreetSegment`. Segments sharing the conservative normalized street name are grouped under one `Street`, regardless of whether they are contiguous. This handles divided roads, disconnected fragments, and relation artifacts without inventing topology. Duplicate way IDs are removed. Empty or invalid coordinate sequences are reported and skipped.

## Application architecture

- `features/municipalities`: search, candidate selection, import orchestration, and cache catalog UI.
- `domain/maps`: domain types plus pure boundary, clipping, normalization, and grouping functions.
- `infrastructure/osm`: Nominatim/Overpass clients, query builders, response parsers, timeout/retry policy, and endpoint configuration.
- `infrastructure/storage`: versioned IndexedDB adapter and migrations.
- `features/study-map`: Leaflet adapter that consumes only the normalized package.
- `app`: composition, routing/state transitions, global error boundary, and styling.

Pure domain functions accept application-owned types and are unit tested without the network, browser database, or Leaflet. Infrastructure is injected behind narrow interfaces so tests can use in-memory fakes. React components coordinate states but do not parse Overpass geometry.

## Offline and cache behavior

- First acquisition requires a network connection.
- A completed package is written atomically; failed imports never replace a valid cached package.
- IndexedDB stores a schema version and supports future migrations.
- The catalog lists cached municipalities, download date, street count, data source, and refresh/remove actions.
- Opening a cached municipality performs no network request.
- Refresh is explicit and keeps the previous package available until the replacement is validated and committed.
- Refresh first reuses and revalidates the cached OSM relation ID. If that relation is missing or no longer represents a valid municipality boundary, the app repeats discovery and may ask the user to resolve candidates again.
- If the browser reports offline status, search/download controls explain that cached municipalities remain available.
- Cache quota and write failures are surfaced with recovery guidance.

## Rendering and initial experience

The initial screen lets the user open a cached municipality or search for another. Colmenarejo is suggested as the first example. Import shows distinct phases: discovering boundary, downloading geometry, processing streets, and saving locally.

Study view uses Leaflet for pan, zoom, fit-to-boundary, and vector interaction, but creates no tile layer. The municipality boundary and cached streets are rendered with Leaflet's canvas renderer against a neutral local background. Street labels are absent by default; selecting a street may identify/highlight it as an inspection aid, not as a persistent basemap label. Visible OpenStreetMap contributor attribution remains present.

## Failure handling

- Abort in-flight requests when the user cancels or starts another import.
- Apply explicit timeouts and a small bounded retry policy only to transient network/server failures.
- Distinguish no candidates, ambiguous candidates, invalid boundary, Overpass timeout/rate limit, malformed payload, offline state, and IndexedDB quota/write failures.
- Preserve the last valid cache on every refresh failure.
- Log import diagnostics without storing unnecessary personal data.

## Testing strategy

- Unit tests for name normalization, segment grouping, candidate ranking, polygon validation, multipolygon/enclave handling, clipping/filtering, query construction, and Overpass parsing.
- Storage contract tests against a browser-compatible IndexedDB implementation, including atomic replacement and schema upgrades.
- React tests for empty, ambiguous, loading, cached, offline, and failure states.
- Integration tests using recorded Colmenarejo fixtures from OSM responses; no test suite depends on live external services.
- A production build is part of final verification.

## Documentation, licensing, and attribution

- Expand `README.md` with product intent, architecture, setup, scripts, offline workflow, data limitations, and screenshots when available.
- Add an open-source code license chosen for the repository; phase 1 will use MIT unless the owner requests another before implementation.
- Add `ATTRIBUTION.md` explaining OpenStreetMap contributors, the Open Database License (ODbL), data modification/derivation, and links to the license and copyright page.
- Show `© OpenStreetMap contributors` in the application even without a tile layer.
- Document that the application code license does not relicense cached OpenStreetMap-derived data.

## Security and privacy

- No account or telemetry is required.
- Municipality packages stay in the local browser database.
- Treat all external strings as data; render text through React and do not inject Overpass/Nominatim HTML.
- Validate payload sizes and geometry before persistence/rendering to reduce accidental browser exhaustion. Limits are documented constants, checked against raw response bytes, element counts, coordinate counts, and final package size; exceeding one aborts atomically with an explanation.

## Decisions left to implementation

- Exact supporting packages for IndexedDB, geometry operations, validation, and testing, chosen for browser compatibility and small maintenance burden.
- Visual styling and responsive layout, provided the offline/cache states and attribution remain clear.
- Configurable Overpass endpoint list and retry timings, bounded and documented.
- Exact IndexedDB database/store names and initial schema version.
