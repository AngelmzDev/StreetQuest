import type { DBSchema } from 'idb'
import type { CachedMunicipalitySummary, MunicipalityPackage } from '../../domain/maps/types'

export const DATABASE_VERSION = 1
export const PACKAGE_STORE = 'municipality-packages'
export const SUMMARY_STORE = 'municipality-summaries'

export interface StreetQuestDatabase extends DBSchema {
  'municipality-packages': {
    key: string
    value: MunicipalityPackage
  }
  'municipality-summaries': {
    key: string
    value: CachedMunicipalitySummary
    indexes: { 'by-fetched-at': string }
  }
}
