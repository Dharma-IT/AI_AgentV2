import assert from 'node:assert/strict'
import test from 'node:test'
import { isGreetingOnly } from '../src/services/maria.service.js'

test('greetings cannot be interpreted as a weight goal', () => {
  for (const greeting of ['Hello', 'Hi!', 'Hola', '¡Hola!', 'Olá', 'Bom dia']) {
    assert.equal(isGreetingOnly(greeting), true, greeting)
  }
  assert.equal(isGreetingOnly('Hello, I want to lose 20 pounds'), false)
  assert.equal(isGreetingOnly('Quiero bajar de peso'), false)
})
