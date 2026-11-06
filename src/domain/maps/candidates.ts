import type { MunicipalityCandidate } from './types'

function normalize(value: string | undefined): string {
  return (value ?? '').normalize('NFKC').trim().toLocaleLowerCase('es')
}

export function rankCandidates(
  candidates: MunicipalityCandidate[],
  request: { query: string; province?: string },
): MunicipalityCandidate[] {
  const query = normalize(request.query)
  const province = normalize(request.province)
  const scored = candidates.map((candidate) => {
    let confidence = 0
    const reasons: string[] = []
    if (normalize(candidate.municipalityName) === query) {
      confidence += 100
      reasons.push('nombre exacto')
    }
    if (candidate.countryCode.toLowerCase() === 'es') {
      confidence += 20
      reasons.push('España')
    }
    if (candidate.adminLevel === 8) {
      confidence += 30
      reasons.push('nivel administrativo 8')
    }
    const candidateContexts = candidate.province ? [candidate.province] : [candidate.region]
    if (province && candidateContexts.some((value) => normalize(value).includes(province))) {
      confidence += 40
      reasons.push('provincia coincidente')
    }
    return { ...candidate, confidence, confidenceReason: reasons.join(', ') || 'coincidencia débil' }
  }).sort((a, b) => b.confidence - a.confidence || a.displayName.localeCompare(b.displayName, 'es') || a.osmId - b.osmId)

  if (scored.length > 1 && scored[0]?.confidence === scored[1]?.confidence) {
    const topScore = scored[0]!.confidence
    return scored.map((candidate) => candidate.confidence === topScore
      ? { ...candidate, confidenceReason: `${candidate.confidenceReason}; requiere selección explícita` }
      : candidate)
  }
  return scored
}
