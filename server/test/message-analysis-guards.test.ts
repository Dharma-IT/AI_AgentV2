import assert from 'node:assert/strict'
import test from 'node:test'
import { isGreetingOnly, isLocationAttempt, isStandaloneLanguageNeutralLocation } from '../src/services/maria.service.js'

test('greetings cannot be interpreted as a weight goal', () => {
  for (const greeting of ['Hello', 'Hi!', 'Hola', '¡Hola!', 'Olá', 'Bom dia']) {
    assert.equal(isGreetingOnly(greeting), true, greeting)
  }
  assert.equal(isGreetingOnly('Hello, I want to lose 20 pounds'), false)
  assert.equal(isGreetingOnly('Quiero bajar de peso'), false)
})

test('standalone US locations are language-neutral and preserve the active conversation language', () => {
  assert.equal(isStandaloneLanguageNeutralLocation('Florida'), true)
  assert.equal(isStandaloneLanguageNeutralLocation('FL'), true)
  assert.equal(isStandaloneLanguageNeutralLocation('Miami'), true)
  assert.equal(isStandaloneLanguageNeutralLocation('Vivo en Florida'), false)
  assert.equal(isStandaloneLanguageNeutralLocation('I live in Florida'), false)
})

test('Spanish availability does not look like an ambiguous location correction', () => {
  assert.equal(isLocationAttempt('Solo estoy disponible los viernes.'), false)
  assert.equal(isLocationAttempt('Estoy en Florida'), true)
  assert.equal(isLocationAttempt('Vivo en Florida'), true)
})
