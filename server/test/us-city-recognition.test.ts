import assert from 'node:assert/strict'
import test from 'node:test'
import { recognizeUSLocation } from '../src/location/us-city-recognition.js'

const representativeCities: Record<string, string> = {
  AL: 'Birmingham', AK: 'Anchorage', AZ: 'Phoenix', AR: 'Little Rock', CA: 'Los Angeles', CO: 'Denver', CT: 'Hartford', DE: 'Dover',
  FL: 'Miami', GA: 'Atlanta', HI: 'Honolulu', ID: 'Boise', IL: 'Chicago', IN: 'Fort Wayne', IA: 'Des Moines', KS: 'Wichita',
  KY: 'Lexington', LA: 'Baton Rouge', ME: 'South Portland', MD: 'Baltimore', MA: 'Boston', MI: 'Detroit', MN: 'Minneapolis', MS: 'Jackson',
  MO: 'St Louis', MT: 'Billings', NE: 'Omaha', NV: 'Las Vegas', NH: 'Manchester', NJ: 'Newark', NM: 'Albuquerque', NY: 'Buffalo',
  NC: 'Charlotte', ND: 'Fargo', OH: 'Cleveland', OK: 'Tulsa', OR: 'Portland', PA: 'Philadelphia', RI: 'Providence', SC: 'Charleston',
  SD: 'Sioux Falls', TN: 'Memphis', TX: 'Houston', UT: 'Salt Lake City', VT: 'Burlington', VA: 'Richmond', WA: 'Seattle',
  WV: 'Morgantown', WI: 'Milwaukee', WY: 'Cheyenne', DC: 'Washington DC',
}

test('offline Census data resolves a representative major city in every state and D.C.', () => {
  assert.equal(Object.keys(representativeCities).length, 51)
  for (const [code, city] of Object.entries(representativeCities)) assert.equal(recognizeUSLocation(city).stateCode, code, city)
})

test('resolves multilingual aliases, accents, sentences, and confident misspellings', () => {
  const examples = [
    ['I live in Miami.', 'FL'], ['Estoy en Los Ángeles.', 'CA'], ['Moro em Miami.', 'FL'],
    ['Vivo en Nueva York.', 'NY'], ['Moro em Nova Iorque.', 'NY'], ['New York City', 'NY'],
    ['I am in Maimi', 'FL'], ['currently staying in Chciago', 'IL'],
  ] as const
  for (const [input, code] of examples) assert.equal(recognizeUSLocation(input).stateCode, code, input)
})

test('validates city and explicit state consistency', () => {
  assert.equal(recognizeUSLocation('Miami, Florida').stateCode, 'FL')
  const mismatch = recognizeUSLocation('Miami, California')
  assert.equal(mismatch.kind, 'inconsistent')
  assert.equal(mismatch.stateCode, null)
})

test('shared and unknown cities are never confirmed', () => {
  const springfield = recognizeUSLocation('Springfield')
  assert.equal(springfield.kind, 'ambiguous')
  assert.equal(springfield.stateCode, null)
  assert.ok(springfield.candidates.length > 1)
  assert.equal(recognizeUSLocation('Notarealcity').stateCode, null)
})
