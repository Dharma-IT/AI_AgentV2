import assert from 'node:assert/strict'
import test from 'node:test'
import { initialGreeting, initialGreetingForLanguage } from '../src/services/conversation.service.js'
import { formatAppointmentStartTime12Hour } from '../src/services/maria.service.js'

test('uses the approved fixed greeting in the contact language', () => {
  assert.equal(initialGreetingForLanguage('en'), initialGreeting)
  assert.match(initialGreetingForLanguage('es'), /^¡Hola! Soy Maria de Dharma Clinic 🌿/)
  assert.match(initialGreetingForLanguage('es'), /¿cuál es tu principal objetivo de peso/)
  assert.match(initialGreetingForLanguage('pt'), /^Olá! Sou Maria da Dharma Clinic 🌿/)
})

test('formats appointment starts with a 12-hour clock for every reply language', () => {
  assert.equal(formatAppointmentStartTime12Hour('2026-10-07T18:40:00.000Z', 'America/New_York'), '2:40 PM')
  assert.equal(formatAppointmentStartTime12Hour('2026-10-07T04:00:00.000Z', 'America/Los_Angeles'), '9:00 PM')
})
