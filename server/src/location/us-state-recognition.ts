export type StateMatchKind = 'exact' | 'alias' | 'fuzzy' | 'ambiguous' | 'none'

export type StateRecognition = {
  kind: StateMatchKind
  stateCode: string | null
  candidates: string[]
  confidence: number
}

type StateDefinition = { code: string; name: string; aliases?: string[] }

// English names remain canonical. Aliases cover established Spanish and Portuguese
// forms; this data is intentionally independent from shipping eligibility.
export const US_STATES: readonly StateDefinition[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California', aliases: ['Califórnia'] },
  { code: 'CO', name: 'Colorado' }, { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida', aliases: ['Flórida'] },
  { code: 'GA', name: 'Georgia', aliases: ['Geórgia'] }, { code: 'HI', name: 'Hawaii', aliases: ['Hawái', 'Havaí'] },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana', aliases: ['Luisiana'] },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan', aliases: ['Míchigan'] },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi', aliases: ['Misisipi'] },
  { code: 'MO', name: 'Missouri', aliases: ['Misuri'] }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire', aliases: ['Nuevo Hampshire', 'Nova Hampshire'] },
  { code: 'NJ', name: 'New Jersey', aliases: ['Nueva Jersey', 'Nova Jersey'] },
  { code: 'NM', name: 'New Mexico', aliases: ['Nuevo México', 'Novo México'] },
  { code: 'NY', name: 'New York', aliases: ['Nueva York', 'Nova Iorque', 'Nova York'] },
  { code: 'NC', name: 'North Carolina', aliases: ['Carolina del Norte', 'Carolina do Norte', 'Carolina'] },
  { code: 'ND', name: 'North Dakota', aliases: ['Dakota del Norte', 'Dakota do Norte', 'Dakota'] },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon', aliases: ['Oregón'] },
  { code: 'PA', name: 'Pennsylvania', aliases: ['Pensilvania', 'Pensilvânia'] },
  { code: 'RI', name: 'Rhode Island', aliases: ['Isla de Rhode', 'Ilha de Rhode'] },
  { code: 'SC', name: 'South Carolina', aliases: ['Carolina del Sur', 'Carolina do Sul', 'Carolina'] },
  { code: 'SD', name: 'South Dakota', aliases: ['Dakota del Sur', 'Dakota do Sul', 'Dakota'] },
  { code: 'TN', name: 'Tennessee', aliases: ['Tenesi'] },
  { code: 'TX', name: 'Texas', aliases: ['Tejas'] }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia', aliases: ['Virgínia'] },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia', aliases: ['Virginia Occidental', 'Virgínia Ocidental'] },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia', aliases: ['Washington DC', 'Washington D C', 'Distrito de Columbia', 'Distrito de Colúmbia'] },
] as const

export function normalizeLocationText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

const canonicalByCode = new Map(US_STATES.map((state) => [state.code, normalizeLocationText(state.name)]))
const aliases = US_STATES.flatMap((state) => {
  const official = normalizeLocationText(state.name)
  return [
    { code: state.code, value: official, kind: 'exact' as const },
    ...(state.aliases ?? []).map((value) => normalizeLocationText(value)).filter((value) => value !== official).map((value) => ({ code: state.code, value, kind: 'alias' as const })),
  ]
})

function phrasePresent(input: string, phrase: string) {
  return (` ${input} `).includes(` ${phrase} `)
}

function levenshtein(left: string, right: string) {
  const matrix = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0))
  for (let i = 0; i <= left.length; i += 1) matrix[i]![0] = i
  for (let j = 0; j <= right.length; j += 1) matrix[0]![j] = j
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(matrix[i - 1]![j]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        matrix[i]![j] = Math.min(matrix[i]![j]!, matrix[i - 2]![j - 2]! + 1)
      }
    }
  }
  return matrix[left.length]![right.length]!
}

function result(kind: StateMatchKind, candidates: string[], confidence: number): StateRecognition {
  const unique = [...new Set(candidates)]
  return { kind: unique.length > 1 ? 'ambiguous' : kind, stateCode: unique.length === 1 && kind !== 'ambiguous' ? (unique[0] ?? null) : null, candidates: unique, confidence: unique.length > 1 ? 0 : confidence }
}

function abbreviationMatches(original: string, normalized: string) {
  const matches: string[] = []
  for (const { code } of US_STATES) {
    const originalPattern = new RegExp(`(?:^|[^A-Za-z])${code}(?:$|[^A-Za-z])`)
    const contextualPattern = new RegExp(`\\b(?:state|estado)\\s+(?:is|es|e|é|do|de)?\\s*${code.toLowerCase()}\\b`)
    if (normalizeLocationText(original) === code.toLowerCase() || originalPattern.test(original) || contextualPattern.test(normalized)) matches.push(code)
  }
  return matches
}

export function recognizeUSState(input: string): StateRecognition {
  const normalized = normalizeLocationText(input)
  if (!normalized) return result('none', [], 0)

  const explicitlyRequestsState = /\b(?:state|estado)\b/.test(normalized)
  if (!explicitlyRequestsState && aliases.some((entry) => phrasePresent(normalized, `${entry.value} city`))) return result('none', [], 0)

  const abbreviationCodes = abbreviationMatches(input, normalized)
  const allExactMatches = aliases.filter((entry) => phrasePresent(normalized, entry.value) && (explicitlyRequestsState || !phrasePresent(normalized, `${entry.value} city`)))
  const exactMatches = allExactMatches.filter((entry) => !allExactMatches.some((other) => other.value !== entry.value && phrasePresent(other.value, entry.value)))
  const exactCodes = [...abbreviationCodes, ...exactMatches.map((entry) => entry.code)]
  if (exactCodes.length) {
    const kind = exactMatches.some((entry) => entry.kind === 'alias') ? 'alias' : 'exact'
    return result(kind, exactCodes, 1)
  }

  // Known multi-word names may be written without spaces.
  const compactInputTokens = normalized.split(' ')
  const compactMatches = aliases.filter((entry) => entry.value.includes(' ') && compactInputTokens.includes(entry.value.replaceAll(' ', '')))
  if (compactMatches.length) return result(compactMatches.some((x) => x.kind === 'alias') ? 'alias' : 'exact', compactMatches.map((x) => x.code), 1)

  const tokens = normalized.split(' ')
  const candidates: Array<{ code: string; score: number }> = []
  for (let size = 1; size <= Math.min(4, tokens.length); size += 1) {
    for (let start = 0; start <= tokens.length - size; start += 1) {
      const fragment = tokens.slice(start, start + size).join('')
      if (fragment.length < 5) continue
      for (const alias of aliases) {
        const target = alias.value.replaceAll(' ', '')
        const distance = levenshtein(fragment, target)
        const allowedDistance = target.length >= 9 ? 2 : 1
        const score = 1 - distance / Math.max(fragment.length, target.length)
        if (distance <= allowedDistance && score >= 0.8) candidates.push({ code: alias.code, score })
      }
    }
  }
  if (!candidates.length) return result('none', [], 0)
  const bestScore = Math.max(...candidates.map((candidate) => candidate.score))
  const best = candidates.filter((candidate) => bestScore - candidate.score < 0.025).map((candidate) => candidate.code)
  return result('fuzzy', best, bestScore)
}

export function officialStateName(code: string) {
  return canonicalByCode.get(code.toUpperCase()) ?? null
}

export function normalizedStateAliases(code: string) {
  return aliases.filter((entry) => entry.code === code.toUpperCase()).map((entry) => entry.value).sort((a, b) => b.length - a.length)
}
