import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mariaMayRespond, type ContactAutomation } from '../src/respond/contact-automation.service.js'

function record(overrides: Partial<ContactAutomation> = {}): ContactAutomation {
  return {
    id: '1', respond_contact_id: '42', contact_name: 'Test Contact', mode: 'maria',
    owner_respond_user_id: null, owner_name: null, preferred_language: 'en',
    evaluation_start_at: null, evaluation_end_at: null, locked_until: null,
    last_action: null, updated_at: new Date(0).toISOString(), ...overrides,
  }
}

describe('Maria contact response policy', () => {
  it('only permits an unassigned Maria contact', () => {
    assert.equal(mariaMayRespond(record(), true), true)
    assert.equal(mariaMayRespond(record(), false), false)
  })

  it('blocks booked contacts until the meeting ends plus 24 hours', () => {
    const locked = record({ mode: 'booked_agent', locked_until: '2026-10-19T15:00:00.000Z' })
    assert.equal(mariaMayRespond(locked, true, Date.parse('2026-10-19T14:59:59.000Z')), false)
    assert.equal(mariaMayRespond(locked, true, Date.parse('2026-10-19T15:00:00.000Z')), true)
  })

  it('keeps Front Desk handoffs blocked even while unassigned', () => {
    assert.equal(mariaMayRespond(record({ mode: 'front_desk' }), true), false)
  })
})
