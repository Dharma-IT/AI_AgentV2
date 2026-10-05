import assert from 'node:assert/strict'
import test from 'node:test'
import { US_STATES, normalizeLocationText, recognizeUSState } from '../src/location/us-state-recognition.js'

test('recognizes all 50 states, Washington D.C., and every USPS abbreviation', () => {
  assert.equal(US_STATES.length, 51)
  for (const state of US_STATES) {
    assert.equal(recognizeUSState(state.name).stateCode, state.code, state.name)
    assert.equal(recognizeUSState(state.code).stateCode, state.code, state.code)
    assert.equal(recognizeUSState(state.code.toLowerCase()).stateCode, state.code, state.code.toLowerCase())
  }
})

test('recognizes Spanish and Portuguese state aliases while ignoring accents and case', () => {
  const examples = [
    ['Estoy en Nueva York.', 'NY'], ['Vivo em Nova Iorque.', 'NY'],
    ['FLÓRIDA', 'FL'], ['California', 'CA'], ['Califórnia', 'CA'],
    ['Soy de Tejas', 'TX'], ['Carolina del Norte', 'NC'], ['Carolina do Norte', 'NC'],
    ['Dakota del Sur', 'SD'], ['Virgínia Ocidental', 'WV'],
    ['Distrito de Colúmbia', 'DC'],
  ] as const
  for (const [input, code] of examples) assert.equal(recognizeUSState(input).stateCode, code, input)
})

test('normalizes punctuation, repeated spaces, missing accents, and known missing spaces', () => {
  assert.equal(normalizeLocationText('  Flórida!!!  '), 'florida')
  assert.equal(recognizeUSState('I live in...   New   York!!!').stateCode, 'NY')
  assert.equal(recognizeUSState('Vivo em NovaIorque').stateCode, 'NY')
  assert.equal(recognizeUSState('newyork').stateCode, 'NY')
  assert.equal(recognizeUSState('My state is TX.').stateCode, 'TX')
})

test('accepts only high-confidence spelling corrections', () => {
  for (const input of ['Floridia', 'Flordia']) assert.deepEqual(recognizeUSState(input), { kind: 'fuzzy', stateCode: 'FL', candidates: ['FL'], confidence: recognizeUSState(input).confidence })
  assert.equal(recognizeUSState('Califronia').stateCode, 'CA')
  assert.equal(recognizeUSState('Pensylvannia').stateCode, 'PA')
  assert.equal(recognizeUSState('Somewhere overseas').kind, 'none')
})

test('extracts states from sentences without treating cities or conjunctions as states', () => {
  assert.equal(recognizeUSState("I'm currently staying in California.").stateCode, 'CA')
  assert.equal(recognizeUSState('I live in Austin.').kind, 'none')
  assert.equal(recognizeUSState('I live in Kansas City.').kind, 'none')
  assert.equal(recognizeUSState('I am in New York City.').kind, 'none')
  assert.equal(recognizeUSState('I may stay here or travel later.').kind, 'none')
  assert.equal(recognizeUSState('Lisbon, Portugal').kind, 'none')
})

test('reports incomplete and multiple-state matches as ambiguous', () => {
  const carolina = recognizeUSState('Carolina')
  assert.equal(carolina.kind, 'ambiguous')
  assert.deepEqual(new Set(carolina.candidates), new Set(['NC', 'SC']))
  assert.equal(carolina.stateCode, null)

  const multiple = recognizeUSState('I moved from Florida to Texas.')
  assert.equal(multiple.kind, 'ambiguous')
  assert.deepEqual(new Set(multiple.candidates), new Set(['FL', 'TX']))
  assert.equal(multiple.stateCode, null)
})

test('prefers complete state names over nested names', () => {
  assert.equal(recognizeUSState('West Virginia').stateCode, 'WV')
  assert.equal(recognizeUSState('Washington, D.C.').stateCode, 'DC')
})
