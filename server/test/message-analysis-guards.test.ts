import assert from 'node:assert/strict'
import test from 'node:test'
import { explicitLanguageHint, explicitSchedulingPreference, isGreetingOnly, isLanguageNeutralMessage, isLocationAttempt, isStandaloneLanguageNeutralLocation } from '../src/services/maria.service.js'

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

test('numbers, phones, times, and option replies are language-neutral', () => {
  for (const message of ['160', '250 lbs', '+1 (619) 760-7843', '10:40 AM', 'A', '2', 'sí', 'ok']) {
    assert.equal(isLanguageNeutralMessage(message), true, message)
  }
  assert.equal(isLanguageNeutralMessage('Mi peso es 250'), false)
  assert.equal(isLanguageNeutralMessage('I weigh 250'), false)
})

test('obvious language signals override uncertain model detection', () => {
  assert.equal(explicitLanguageHint('Dónde están ubicados'), 'es')
  assert.equal(explicitLanguageHint('Quiero perder 20 libras'), 'es')
  assert.equal(explicitLanguageHint('Onde vocês estão localizados?'), 'pt')
  assert.equal(explicitLanguageHint('Where are you located?'), 'en')
  assert.equal(explicitLanguageHint('160'), null)
  assert.equal(explicitLanguageHint('California'), null)
})

test('relative dates and explicit times are retained as scheduling preferences', () => {
  for (const message of [
    'I am only available tomorrow',
    '3:00 PM today',
    'the day after tomorrow',
    'mañana a las 3:00 PM',
    'pasado mañana',
    'amanhã às 3:00 PM',
    'depois de amanhã',
  ]) assert.equal(explicitSchedulingPreference(message), message)
  assert.equal(explicitSchedulingPreference('I have a question'), null)
})

test('Spanish availability does not look like an ambiguous location correction', () => {
  assert.equal(isLocationAttempt('Solo estoy disponible los viernes.'), false)
  assert.equal(isLocationAttempt('Estoy en Florida'), true)
  assert.equal(isLocationAttempt('Vivo en Florida'), true)
})
