import assert from 'node:assert/strict'
import test from 'node:test'
import { getAgentCallbackNumber } from '../src/appointments/agent-callback.service.js'

test('selects the open Aircall number named for the assigned agent', async () => {
  const result = await getAgentCallbackNumber(96663739, {
    async listUserNumbers() {
      return [
        { id: 1, name: 'Dharma Clinic 02', digits: '+1 561-221-1635', country: 'US', open: true },
        { id: 2, name: 'Zara Meza', digits: '+1 754-219-6447', country: 'US', open: true },
      ]
    },
  })
  assert.equal(result.aircallNumberId, 2)
  assert.equal(result.digits, '+1 754-219-6447')
})

test('Alice and Aline aliases select Alice Strelow Aircall number', async () => {
  const result = await getAgentCallbackNumber(62115861, {
    async listUserNumbers() {
      return [{ id: 3, name: 'Alice Strelow', digits: '+1 386-800-2083', country: 'US', open: true }]
    },
  })
  assert.equal(result.aircallNumberId, 3)
})

test('rejects multiple open generic numbers instead of guessing', async () => {
  await assert.rejects(() => getAgentCallbackNumber(96663739, {
    async listUserNumbers() {
      return [
        { id: 1, name: 'Generic One', digits: '+1 555-000-0001', country: 'US', open: true },
        { id: 2, name: 'Generic Two', digits: '+1 555-000-0002', country: 'US', open: true },
      ]
    },
  }), /No unambiguous open Aircall number/)
})
