import { openDB } from 'idb'
import { mapEngineError, type CachedMunicipalitySummary, type MunicipalityPackage } from '../../domain/maps/types'
import { DATABASE_VERSION, PACKAGE_STORE, SUMMARY_STORE, type StreetQuestDatabase } from './schema'

export interface MunicipalityStore {
  list(): Promise<CachedMunicipalitySummary[]>
  get(id: string): Promise<MunicipalityPackage | undefined>
  replaceAtomically(pkg: MunicipalityPackage): Promise<void>
  remove(id: string): Promise<void>
}

interface StoreTestOptions {
  beforeSummaryPut?(): void
}

function storageError(error: unknown) {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return mapEngineError('storage-quota', 'No hay espacio suficiente para guardar el municipio', false, error)
  }
  return mapEngineError('storage', 'No se pudo actualizar la caché local', false, error)
}

export function createMunicipalityStore(
  dbName = 'streetquest',
  testOptions: StoreTestOptions = {},
): MunicipalityStore {
  const database = openDB<StreetQuestDatabase>(dbName, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PACKAGE_STORE)) db.createObjectStore(PACKAGE_STORE)
      if (!db.objectStoreNames.contains(SUMMARY_STORE)) {
        db.createObjectStore(SUMMARY_STORE).createIndex('by-fetched-at', 'fetchedAt')
      }
    },
  })

  return {
    async list() {
      const db = await database
      const summaries = await db.getAll(SUMMARY_STORE)
      return summaries.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt) || a.name.localeCompare(b.name, 'es'))
    },

    async get(id) {
      return (await database).get(PACKAGE_STORE, id)
    },

    async replaceAtomically(pkg) {
      if (pkg.schemaVersion !== DATABASE_VERSION) {
        throw mapEngineError('storage', `Versión de paquete no compatible: ${String(pkg.schemaVersion)}`)
      }
      const db = await database
      const transaction = db.transaction([PACKAGE_STORE, SUMMARY_STORE], 'readwrite')
      try {
        await transaction.objectStore(PACKAGE_STORE).put(pkg, pkg.id)
        testOptions.beforeSummaryPut?.()
        await transaction.objectStore(SUMMARY_STORE).put({
          id: pkg.id,
          name: pkg.municipality.municipalityName,
          province: pkg.municipality.province,
          streetCount: pkg.streets.length,
          fetchedAt: pkg.source.fetchedAt,
        }, pkg.id)
        await transaction.done
      } catch (error) {
        try { transaction.abort() } catch { /* transaction already completed or aborted */ }
        try { await transaction.done } catch { /* preserve original failure */ }
        throw storageError(error)
      }
    },

    async remove(id) {
      const db = await database
      const transaction = db.transaction([PACKAGE_STORE, SUMMARY_STORE], 'readwrite')
      try {
        await Promise.all([
          transaction.objectStore(PACKAGE_STORE).delete(id),
          transaction.objectStore(SUMMARY_STORE).delete(id),
        ])
        await transaction.done
      } catch (error) {
        throw storageError(error)
      }
    },
  }
}
