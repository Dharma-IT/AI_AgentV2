import assert from 'node:assert/strict'
import test from 'node:test'
import { initialGreeting, initialGreetingForLanguage } from '../src/services/conversation.service.js'

test('uses the approved fixed greeting in the contact language', () => {
  assert.equal(initialGreetingForLanguage('en'), initialGreeting)
  assert.match(initialGreetingForLanguage('es'), /^¡Hola! Soy Maria de Dharma Clinic 🌿/)
  assert.match(initialGreetingForLanguage('es'), /¿cuál es tu principal objetivo de peso/)
  assert.match(initialGreetingForLanguage('pt'), /^Olá! Sou Maria da Dharma Clinic 🌿/)
})
