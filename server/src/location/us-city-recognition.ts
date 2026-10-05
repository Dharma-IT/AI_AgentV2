import censusPlaces from './data/us-census-places-2026.json' with { type: 'json' }
import { normalizeLocationText, normalizedStateAliases, recognizeUSState, type StateRecognition } from './us-state-recognition.js'

export type LocationMatchKind = StateRecognition['kind'] | 'city_exact' | 'city_alias' | 'city_fuzzy' | 'inconsistent'
export type LocationRecognition = Omit<StateRecognition, 'kind'> & { kind: LocationMatchKind; city?: string }

const places = censusPlaces as Record<string, string[]>
const placeNames = Object.keys(places)
const cityAliases: Record<string, string> = {
  'los angeles': 'los angeles',
  'nova iorque': 'new york',
  'nova york': 'new york',
  'nueva york': 'new york',
  'new york city': 'new york',
}
const majorCities: Record<string, string> = {
  birmingham: 'AL', anchorage: 'AK', phoenix: 'AZ', 'little rock': 'AR', 'los angeles': 'CA', denver: 'CO', hartford: 'CT', dover: 'DE',
  miami: 'FL', atlanta: 'GA', honolulu: 'HI', boise: 'ID', chicago: 'IL', 'fort wayne': 'IN', 'des moines': 'IA', wichita: 'KS',
  lexington: 'KY', 'baton rouge': 'LA', 'south portland': 'ME', baltimore: 'MD', boston: 'MA', detroit: 'MI', minneapolis: 'MN', jackson: 'MS',
  'st louis': 'MO', billings: 'MT', omaha: 'NE', 'las vegas': 'NV', manchester: 'NH', newark: 'NJ', albuquerque: 'NM', 'new york': 'NY',
  charlotte: 'NC', fargo: 'ND', cleveland: 'OH', tulsa: 'OK', portland: 'OR', philadelphia: 'PA', providence: 'RI', charleston: 'SC', buffalo: 'NY',
  'sioux falls': 'SD', memphis: 'TN', houston: 'TX', 'salt lake city': 'UT', burlington: 'VT', richmond: 'VA', seattle: 'WA',
  morgantown: 'WV', milwaukee: 'WI', cheyenne: 'WY', 'washington dc': 'DC',
}

function distance(left: string, right: string) {
  const matrix = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0))
  for (let i = 0; i <= left.length; i += 1) matrix[i]![0] = i
  for (let j = 0; j <= right.length; j += 1) matrix[0]![j] = j
  for (let i = 1; i <= left.length; i += 1) for (let j = 1; j <= right.length; j += 1) {
    const cost = left[i - 1] === right[j - 1] ? 0 : 1
    matrix[i]![j] = Math.min(matrix[i - 1]![j]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j - 1]! + cost)
    if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) matrix[i]![j] = Math.min(matrix[i]![j]!, matrix[i - 2]![j - 2]! + 1)
  }
  return matrix[left.length]![right.length]!
}

function cityMatches(input: string, explicitState: string | null) {
  let normalized = normalizeLocationText(input)
  if (explicitState) for (const alias of normalizedStateAliases(explicitState)) normalized = (` ${normalized} `).replace(` ${alias} `, ' ').trim().replace(/\s+/g, ' ')
  if (!normalized) return null
  const tokens = normalized.split(' ')
  const matches = new Map<string, { states: string[]; alias: boolean }>()
  for (let size = 1; size <= Math.min(6, tokens.length); size += 1) for (let start = 0; start <= tokens.length - size; start += 1) {
    const phrase = tokens.slice(start, start + size).join(' ')
    const canonical = cityAliases[phrase] ?? phrase
    const states = majorCities[canonical] ? [majorCities[canonical]!] : places[canonical]
    if (states) matches.set(canonical, { states, alias: canonical !== phrase })
  }
  if (!matches.size) return null
  const majorMatches = [...matches.entries()].filter(([name]) => Boolean(majorCities[name]))
  const pool = majorMatches.length ? majorMatches : [...matches.entries()]
  const longest = Math.max(...pool.map(([name]) => name.split(' ').length))
  const selected = pool.filter(([name]) => name.split(' ').length === longest)
  return { city: selected.map(([name]) => name).join(', '), states: [...new Set(selected.flatMap(([, value]) => value.states))], alias: selected.some(([, value]) => value.alias) }
}

function fuzzyCity(input: string) {
  const normalized = normalizeLocationText(input)
  const tokens = normalized.split(' ')
  let bestScore = 0
  const matches: Array<{ city: string; states: string[]; score: number }> = []
  for (let size = 1; size <= Math.min(4, tokens.length); size += 1) for (let start = 0; start <= tokens.length - size; start += 1) {
    const fragment = tokens.slice(start, start + size).join(' ')
    if (fragment.length < 5) continue
    for (const city of [...Object.keys(majorCities), ...placeNames]) {
      if (Math.abs(city.length - fragment.length) > 2) continue
      const edits = distance(fragment, city)
      const allowed = city.length >= 9 ? 2 : 1
      const score = 1 - edits / Math.max(fragment.length, city.length)
      const threshold = majorCities[city] ? 0.8 : 0.84
      if (edits <= allowed && score >= threshold) {
        if (score > bestScore) bestScore = score
        matches.push({ city, states: majorCities[city] ? [majorCities[city]!] : (places[city] ?? []), score })
      }
    }
  }
  const best = matches.filter((match) => bestScore - match.score < 0.02)
  if (!best.length) return null
  return { city: best[0]?.city ?? '', states: [...new Set(best.flatMap((match) => match.states))], score: bestScore }
}

export function recognizeUSLocation(input: string): LocationRecognition {
  const state = recognizeUSState(input)
  const normalized = normalizeLocationText(input)
  if (state.stateCode) {
    const translatedCity = Object.entries(cityAliases).find(([alias, canonical]) => (` ${normalized} `).includes(` ${alias} `) && majorCities[canonical] === state.stateCode)
    if (translatedCity) return { ...state, city: translatedCity[1] }
  }
  const city = cityMatches(input, state.stateCode)
  if (city && state.stateCode) {
    if (city.states.includes(state.stateCode)) return { ...state, city: city.city }
    return { kind: 'inconsistent', stateCode: null, candidates: [...new Set([state.stateCode, ...city.states])], confidence: 0, city: city.city }
  }
  if (city && state.kind === 'ambiguous') {
    const overlap = city.states.filter((code) => state.candidates.includes(code))
    if (overlap.length === 1) return { kind: city.alias ? 'city_alias' : 'city_exact', stateCode: overlap[0] ?? null, candidates: overlap, confidence: 1, city: city.city }
  }
  if (state.stateCode || state.kind === 'ambiguous') return state
  if (city) return { kind: city.states.length === 1 ? (city.alias ? 'city_alias' : 'city_exact') : 'ambiguous', stateCode: city.states.length === 1 ? (city.states[0] ?? null) : null, candidates: city.states, confidence: city.states.length === 1 ? 1 : 0, city: city.city }
  const fuzzy = fuzzyCity(input)
  if (fuzzy) return { kind: fuzzy.states.length === 1 ? 'city_fuzzy' : 'ambiguous', stateCode: fuzzy.states.length === 1 ? (fuzzy.states[0] ?? null) : null, candidates: fuzzy.states, confidence: fuzzy.states.length === 1 ? fuzzy.score : 0, city: fuzzy.city }
  return state
}
