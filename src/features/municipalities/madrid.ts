import type { MunicipalityPackage } from '../../domain/maps/types'
import type { MunicipalityStore } from '../../infrastructure/storage/municipalityStore'

export async function openBundledMadrid(store: MunicipalityStore): Promise<MunicipalityPackage> {
  const cached = await store.get('relation-5326784')
  if (cached) return cached

  const response = await fetch(`${import.meta.env.BASE_URL}madrid-package.json`)
  if (!response.ok) throw new Error('El mapa incluido de Madrid no está disponible.')
  const pkg = await response.json() as MunicipalityPackage
  if (pkg.id !== 'relation-5326784' || pkg.municipality.municipalityName !== 'Madrid' || pkg.streets.length < 1000) {
    throw new Error('El mapa incluido de Madrid está incompleto.')
  }
  await store.replaceAtomically(pkg)
  return pkg
}
