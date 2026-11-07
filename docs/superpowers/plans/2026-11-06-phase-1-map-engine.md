# StreetQuest Phase 1 Map Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only StreetQuest foundation that downloads a Spanish municipality once, stores normalized boundary and street vectors in IndexedDB, and renders a label-free study map fully offline.

**Architecture:** Pure domain modules own candidate ranking, geometry validation, clipping, grouping, and package limits. Thin infrastructure adapters handle Nominatim, Overpass, IndexedDB, and the service worker; a React import workflow composes them and a Leaflet Canvas view consumes only cached domain records.

**Tech Stack:** React 19, TypeScript 5, Vite 7, Leaflet 1.9, `idb`, `osmtogeojson`, focused Turf geometry packages, Vitest, Testing Library, `fake-indexeddb`, MSW, Playwright, and `vite-plugin-pwa`.

**Spec:** `docs/superpowers/specs/2026-11-06-phase-1-map-engine-design.md`

## Global Constraints

- Preserve and expand the existing `README.md`; do not replace its identity or product description.
- Runtime remains browser-only: no backend, no online tile layer, and no network access when opening a cached municipality.
- Colmenarejo is a default/example and fixture target, never a hard-coded relation ID.
- Keep domain logic independent from React, Leaflet, raw Overpass shapes, and IndexedDB.
- All external requests are bounded, abortable, timeout-aware, and return typed actionable errors.
- Default safety limits are 64 MiB per raw response, 250,000 OSM elements, 2,000,000 coordinates, and 128 MiB for the serialized final package.
- A cache refresh is atomic and preserves the previous valid package on every failure.
- Show `© OpenStreetMap contributors`; license code under MIT and document derived data under ODbL.
- Implement behavior with strict red-green-refactor cycles and make each task an independently testable commit.

## File Structure

- `src/domain/maps/types.ts`: stable application-owned map and package types.
- `src/domain/maps/candidates.ts`: candidate normalization and deterministic ranking.
- `src/domain/maps/boundaries.ts`: GeoJSON boundary extraction and validation.
- `src/domain/maps/streets.ts`: way filtering, clipping, name normalization, grouping, and limits.
- `src/infrastructure/osm/nominatimClient.ts`: municipality discovery adapter.
- `src/infrastructure/osm/overpassClient.ts`: bounded HTTP transport and typed failures.
- `src/infrastructure/osm/queries.ts`: authoritative boundary and street query builders.
- `src/infrastructure/osm/parsers.ts`: raw Overpass-to-domain parsing.
- `src/infrastructure/storage/municipalityStore.ts`: versioned IndexedDB contract.
- `src/features/municipalities/importMunicipality.ts`: import/refresh orchestration.
- `src/features/municipalities/MunicipalityHome.tsx`: cached catalog, search, selection, and progress UI.
- `src/features/study-map/StudyMap.tsx`: tile-free Leaflet Canvas adapter.
- `src/app/App.tsx`: screen composition and offline status.
- `src/test/fixtures/colmenarejo-*.json`: bounded recorded source fixtures.

## Review Focus

- A relation with disjoint outers or inner enclaves must remain a valid multipolygon and clip streets correctly (Task 3 tests).
- Aborted, timed-out, rate-limited, and oversized Overpass responses must produce distinct errors without overwriting cache (Tasks 2 and 7 tests).
- Two disconnected clipped parts from one OSM way must receive stable unique IDs and remain grouped under one street (Task 4 tests).
- A refresh whose relation disappeared must rediscover candidates while keeping the prior cached package usable (Task 7 tests).
- Reloading the built app offline must load the application shell and open IndexedDB data without requesting Nominatim, Overpass, or tiles (Task 9 tests).

---

### Task 1: Application shell, test harness, and domain contracts

**Files:**
- Create: `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/app/styles.css`, `src/domain/maps/types.ts`, `src/test/setup.ts`
- Create: `src/app/App.test.tsx`

**Interfaces:**
- Produces: `OsmIdentity`, `Position`, `BBox`, `PolygonGeometry`, `MultiPolygonGeometry`, `MunicipalityCandidate`, `MunicipalityBoundary`, `StreetSegment`, `Street`, `MunicipalityPackage`, `CachedMunicipalitySummary`, `ImportPhase`, and `MapEngineError` discriminated unions in `types.ts`.
- Produces scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `test:e2e`, `lint`, and `typecheck`.

- [ ] **Step 1: Create only the Vite/Vitest configuration and write a failing shell test**

`App.test.tsx` renders `<App />` and asserts the product name, the Colmenarejo example action, and the absence of any Leaflet tile container or tile URL.

- [ ] **Step 2: Run `npm test -- --run src/app/App.test.tsx`**

Expected: FAIL because `App` and domain contracts do not exist.

- [ ] **Step 3: Add the minimal React shell, shared CSS, and exact domain contracts**

Use strict TypeScript; represent geometry as GeoJSON-compatible application types and errors as `{ kind, message, retryable, cause? }`. Do not add network/storage behavior.

- [ ] **Step 4: Run `npm test -- --run`, `npm run typecheck`, and `npm run build`**

Expected: all exit 0 with no TypeScript errors.

- [ ] **Step 5: Commit**

`git commit -m "chore: scaffold StreetQuest application"`

### Task 2: Bounded OpenStreetMap transports and query builders

**Files:**
- Create: `src/infrastructure/osm/config.ts`, `src/infrastructure/osm/queries.ts`, `src/infrastructure/osm/nominatimClient.ts`, `src/infrastructure/osm/overpassClient.ts`
- Create: `src/infrastructure/osm/queries.test.ts`, `src/infrastructure/osm/clients.test.ts`

**Interfaces:**
- Consumes: `BBox`, `MunicipalityCandidate`, `MapEngineError`.
- Produces: `searchMunicipalities(query: string, options: { countryCode: 'es'; signal: AbortSignal }): Promise<MunicipalityCandidate[]>`.
- Produces: `executeOverpass(query: string, options: { signal: AbortSignal; timeoutMs: number; maxBytes: number }): Promise<unknown>`.
- Produces: `buildBoundaryQuery(relationId: number): string` and `buildStreetQuery(input: { relationId: number; bbox: BBox; mode: 'area' | 'bbox' }): string`.

- [ ] **Step 1: Write failing transport and query tests**

Assert submit-only Nominatim search with `countrycodes=es`, exact relation-ID boundary query, allowlisted named highway categories, bbox fallback, caller abort propagation, timeout classification, HTTP 429 classification, malformed JSON classification, and a byte-limit abort.

- [ ] **Step 2: Run `npm test -- --run src/infrastructure/osm`**

Expected: FAIL because clients and builders are missing.

- [ ] **Step 3: Implement the query builders and injected-fetch clients**

Use exported factory overloads accepting `fetchImpl` for tests; combine caller cancellation with an internal timeout; never retry inside the raw transport.

- [ ] **Step 4: Run `npm test -- --run` and `npm run typecheck`**

Expected: all tests pass and types are clean.

- [ ] **Step 5: Commit**

`git commit -m "feat: add bounded OpenStreetMap clients"`

### Task 3: Candidate ranking and robust municipal boundaries

**Files:**
- Create: `src/domain/maps/candidates.ts`, `src/domain/maps/boundaries.ts`, `src/infrastructure/osm/parsers.ts`
- Create: `src/domain/maps/candidates.test.ts`, `src/domain/maps/boundaries.test.ts`, `src/infrastructure/osm/parsers.test.ts`
- Create: `src/test/fixtures/colmenarejo-boundary.json`, `src/test/fixtures/multipolygon-enclave.json`

**Interfaces:**
- Consumes: raw Nominatim candidates and raw Overpass JSON.
- Produces: `rankCandidates(candidates: MunicipalityCandidate[], request: { query: string; province?: string }): MunicipalityCandidate[]` with explicit confidence reasons.
- Produces: `parseMunicipalityBoundary(payload: unknown, relationId: number): MunicipalityBoundary`.
- Produces: `validateBoundaryGeometry(geometry: PolygonGeometry | MultiPolygonGeometry): BBox`.

- [ ] **Step 1: Write failing candidate and boundary tests**

Cover preferred Spanish `admin_level=8`, province context, same-score ambiguity, closed polygon rings, multiple outer polygons, inner enclave preservation, non-finite coordinates, missing outer rings, empty geometry, wrong relation ID, and an implausible world-sized result.

- [ ] **Step 2: Run `npm test -- --run src/domain/maps/candidates.test.ts src/domain/maps/boundaries.test.ts src/infrastructure/osm/parsers.test.ts`**

Expected: FAIL because ranking and parsing functions are missing.

- [ ] **Step 3: Implement deterministic ranking and `osmtogeojson` boundary extraction**

Candidate ranking may order results but must mark ties for UI selection. Boundary parsing accepts Polygon/MultiPolygon only, closes rings defensively, preserves inners, computes bounds, and throws typed validation errors.

- [ ] **Step 4: Run `npm test -- --run` and `npm run typecheck`**

Expected: suite passes, including recorded Colmenarejo and enclave fixtures.

- [ ] **Step 5: Commit**

`git commit -m "feat: validate municipal boundaries"`

### Task 4: Street parsing, clipping, grouping, and safety limits

**Files:**
- Create: `src/domain/maps/streets.ts`, `src/domain/maps/limits.ts`
- Create: `src/domain/maps/streets.test.ts`, `src/domain/maps/limits.test.ts`
- Create: `src/test/fixtures/colmenarejo-streets.json`
- Modify: `src/infrastructure/osm/parsers.ts`
- Modify: `src/infrastructure/osm/parsers.test.ts`

**Interfaces:**
- Produces: `parseStreetWays(payload: unknown): SourceStreetWay[]` where `SourceStreetWay = { sourceWayId: number; name: string; highway: string; coordinates: Position[] }`.
- Produces: `clipWayToBoundary(way: SourceStreetWay, boundary: MunicipalityBoundary): StreetSegment[]` with IDs `<sourceWayId>:<partIndex>`.
- Produces: `normalizeStreetName(name: string): string` and `groupStreetSegments(municipalityId: string, segments: StreetSegment[]): Street[]`.
- Produces: `assertPackageLimits(stats: PackageStats, limits?: PackageLimits): void` with defaults of 64 MiB raw response, 250,000 elements, 2,000,000 coordinates, and 128 MiB serialized package size.

- [ ] **Step 1: Write failing street behavior tests**

Cover the highway allowlist, unnamed/excluded ways, Unicode and whitespace normalization, duplicate way IDs, a crossing line clipped to one part, one way clipped to two disconnected parts, enclave exclusion, disconnected same-name grouping, deterministic IDs, invalid coordinates, and every safety limit independently.

- [ ] **Step 2: Run `npm test -- --run src/domain/maps/streets.test.ts src/domain/maps/limits.test.ts src/infrastructure/osm/parsers.test.ts`**

Expected: FAIL because the street pipeline is missing.

- [ ] **Step 3: Implement parsing and pure Turf-backed clipping/grouping**

Split lines against polygon boundaries, retain only parts whose interior point belongs to the polygon and not an inner ring, sort parts deterministically, and calculate a stable street ID from municipality ID plus normalized name.

- [ ] **Step 4: Run `npm test -- --run` and `npm run typecheck`**

Expected: suite passes with stable Colmenarejo fixture counts recorded in assertions.

- [ ] **Step 5: Commit**

`git commit -m "feat: normalize municipal street geometry"`

### Task 5: Versioned atomic IndexedDB cache

**Files:**
- Create: `src/infrastructure/storage/municipalityStore.ts`, `src/infrastructure/storage/schema.ts`
- Create: `src/infrastructure/storage/municipalityStore.test.ts`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Consumes: `MunicipalityPackage`, `CachedMunicipalitySummary`.
- Produces: `MunicipalityStore` with `list(): Promise<CachedMunicipalitySummary[]>`, `get(id: string): Promise<MunicipalityPackage | undefined>`, `replaceAtomically(pkg: MunicipalityPackage): Promise<void>`, and `remove(id: string): Promise<void>`.
- Produces: `createMunicipalityStore(dbName?: string): MunicipalityStore` using schema version `1`.

- [ ] **Step 1: Write failing storage contract tests with `fake-indexeddb`**

Assert empty catalog, package round-trip, newest-first summaries, replacement without duplicate summaries, removal, schema-version rejection, transaction abort preserving the old package, and quota/write errors mapped to `MapEngineError`.

- [ ] **Step 2: Run `npm test -- --run src/infrastructure/storage/municipalityStore.test.ts`**

Expected: FAIL because the store does not exist.

- [ ] **Step 3: Implement the `idb` adapter with one atomic read-write transaction**

Store packages and summaries in separate object stores updated by the same transaction; accept an injected failure hook only in the factory's test options.

- [ ] **Step 4: Run `npm test -- --run` and `npm run typecheck`**

Expected: all storage and full-suite tests pass.

- [ ] **Step 5: Commit**

`git commit -m "feat: cache municipalities in IndexedDB"`

### Task 6: Import and refresh orchestration

**Files:**
- Create: `src/features/municipalities/importMunicipality.ts`, `src/features/municipalities/importMunicipality.test.ts`

**Interfaces:**
- Consumes: injected `NominatimGateway`, `OverpassGateway`, `MunicipalityStore`, and pure parsers from Tasks 2–5.
- Produces: `discoverMunicipalities(input: { query: string; province?: string; signal: AbortSignal }): Promise<DiscoveryResult>` where result is `{ kind: 'none' } | { kind: 'selection-required'; candidates } | { kind: 'selected'; candidate }`.
- Produces: `importMunicipality(candidate: MunicipalityCandidate, options: { signal: AbortSignal; onProgress(phase: ImportPhase): void }): Promise<MunicipalityPackage>`.
- Produces: `refreshMunicipality(cached: MunicipalityPackage, options): Promise<MunicipalityPackage>`.

- [ ] **Step 1: Write failing orchestration tests with in-memory gateways**

Assert progress phase order, automatic unique selection, ambiguous selection, area query then bounded fallback, atomic save only after full validation, cancel behavior, transient retry capped at two attempts, no retry for validation/429, preservation on failed refresh, relation-ID refresh, and rediscovery when the relation vanished.

- [ ] **Step 2: Run `npm test -- --run src/features/municipalities/importMunicipality.test.ts`**

Expected: FAIL because orchestration functions are missing.

- [ ] **Step 3: Implement the use-case functions without React dependencies**

Build a schema-version-1 package with source endpoint/timestamps and attribution; retry only retryable transport failures with injected delay for deterministic tests.

- [ ] **Step 4: Run `npm test -- --run` and `npm run typecheck`**

Expected: all orchestration and full-suite tests pass.

- [ ] **Step 5: Commit**

`git commit -m "feat: orchestrate municipality imports"`

### Task 7: Municipality catalog and resilient import UI

**Files:**
- Create: `src/features/municipalities/MunicipalityHome.tsx`, `src/features/municipalities/MunicipalityHome.test.tsx`, `src/features/municipalities/useOnlineStatus.ts`
- Modify: `src/app/App.tsx`, `src/app/styles.css`

**Interfaces:**
- Consumes: the Task 6 use cases and `MunicipalityStore` through an `AppServices` prop/context.
- Produces: callbacks `onOpenMunicipality(id: string)` and UI states for catalog, search, candidate selection, progress, cancel, refresh, remove, offline, and typed failures.

- [ ] **Step 1: Write failing React behavior tests**

Assert Colmenarejo-prefilled search, cached cards without network calls, offline search disabled while cached open remains enabled, candidate ambiguity dialog, phase-specific progress, cancellation, refresh preserving the card on error, removal confirmation, quota guidance, rate-limit guidance, and escaped external candidate text.

- [ ] **Step 2: Run `npm test -- --run src/features/municipalities/MunicipalityHome.test.tsx`**

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement accessible components and reducer-based UI state**

Keep external strings as React text, expose status through `aria-live`, retain the prior catalog during imports, and perform search only on explicit form submission.

- [ ] **Step 4: Run `npm test -- --run`, `npm run typecheck`, and `npm run lint`**

Expected: all exit 0 with no accessibility query failures.

- [ ] **Step 5: Commit**

`git commit -m "feat: add municipality import experience"`

### Task 8: Tile-free Leaflet study map

**Files:**
- Create: `src/features/study-map/StudyMap.tsx`, `src/features/study-map/StudyMap.test.tsx`, `src/features/study-map/leafletAdapter.ts`
- Modify: `src/app/App.tsx`, `src/app/styles.css`, `src/main.tsx`

**Interfaces:**
- Consumes: `MunicipalityPackage` loaded only through `MunicipalityStore.get`.
- Produces: `<StudyMap municipality={pkg} onBack={fn} />` and `createStudyMap(container, pkg): { destroy(): void; selectStreet(id: string): void }`.

- [ ] **Step 1: Write failing component and adapter tests**

Assert no `TileLayer`/tile request, Canvas renderer selection, fit to validated boundary, all polygon outers/inners and street parts rendered, attribution visible, street selection highlight/name, back navigation, adapter cleanup, and a 20,000-segment synthetic package handled without per-segment React nodes.

- [ ] **Step 2: Run `npm test -- --run src/features/study-map`**

Expected: FAIL because the map and adapter are missing.

- [ ] **Step 3: Implement the imperative Leaflet Canvas adapter and thin React lifecycle wrapper**

Use no tile layer or remote image/font; render grouped GeoJSON layers and keep labels hidden until selection.

- [ ] **Step 4: Run `npm test -- --run`, `npm run typecheck`, and `npm run build`**

Expected: all exit 0 and build output contains no configured tile URL.

- [ ] **Step 5: Commit**

`git commit -m "feat: render offline study maps"`

### Task 9: Offline application shell and end-to-end integration

**Files:**
- Modify: `vite.config.ts`, `src/main.tsx`, `src/app/App.tsx`
- Create: `src/app/App.integration.test.tsx`, `public/icon.svg`
- Create: `playwright.config.ts`, `e2e/offline.spec.ts`

**Interfaces:**
- Consumes: all prior UI and store interfaces.
- Produces: a generated service worker that precaches the application shell only; municipality data remains in IndexedDB.

- [ ] **Step 1: Write failing integration tests**

Seed a Colmenarejo package, render offline, open it, and assert no Nominatim/Overpass/tile request; also assert a first-time offline user receives a clear download requirement. Add a build-config test that requires manifest and service-worker registration. In Playwright, load the built app once, seed IndexedDB, switch the browser context offline, reload, and open the cached study map successfully.

- [ ] **Step 2: Run `npm test -- --run src/app/App.integration.test.tsx`**

Expected: FAIL because the offline shell and composed flow are incomplete.

- [ ] **Step 3: Configure `vite-plugin-pwa` and compose production services**

Precache hashed local assets, register with `autoUpdate`, avoid runtime caching external OSM responses, and keep all package persistence in IndexedDB.

- [ ] **Step 4: Run `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`**

Expected: all exit 0; `dist` contains a manifest and service worker, and integration tests observe zero external calls in cached study mode.

- [ ] **Step 5: Commit**

`git commit -m "feat: enable offline StreetQuest shell"`

### Task 10: Documentation, licensing, attribution, and final verification

**Files:**
- Modify: `README.md`
- Create: `LICENSE`, `ATTRIBUTION.md`, `.gitignore`, `.env.example`, `docs/architecture.md`
- Modify: `package.json`

**Interfaces:**
- Produces: contributor-facing setup, configuration, data flow, offline workflow, limitations, scripts, and OSM/ODbL obligations.
- Produces: MIT code license and explicit statement that cached OSM-derived data remains governed by ODbL.

- [ ] **Step 1: Write a failing repository-compliance test**

Create `src/test/repositoryCompliance.test.ts` asserting the README retains the original product sentence, required scripts are documented, `ATTRIBUTION.md` links to OpenStreetMap copyright and ODbL, the UI attribution string exists, `.gitignore` covers Node/Vite/local environment output, and no secret-valued `.env` is tracked.

- [ ] **Step 2: Run `npm test -- --run src/test/repositoryCompliance.test.ts`**

Expected: FAIL because the documentation and license files are incomplete.

- [ ] **Step 3: Add the documentation and legal files**

Document Nominatim/Overpass usage etiquette, configurable endpoints, exact safety limits, cache refresh/removal, fixture provenance, expected data imperfections, architecture boundaries, and commands.

- [ ] **Step 4: Run fresh full verification**

Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run build`, and `npm run test:e2e`; inspect `git diff --check`, `git status --short`, and the built asset list. Expected: every command exits 0, no warnings that affect correctness, and only intentional repository files remain.

- [ ] **Step 5: Commit**

`git commit -m "docs: document StreetQuest phase 1"`

## Final Review Gate

- Compare the implementation line by line with the approved design and this plan.
- Request an independent whole-branch code review against the base commit `870e101`.
- Fix every Critical or Important finding with a reproducing failing test first.
- Re-run the complete verification commands after review fixes.
- Use `superpowers:finishing-a-development-branch` to offer push-and-PR integration against `main`.
