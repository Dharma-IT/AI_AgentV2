import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findEligibleUserByHubSpotUserId,
  INTEGRATION_USER_MAPPINGS,
} from '../src/integrations/user-mapping/user-mapping.js'

test('only Sales and Customer Service users are booking eligible', () => {
  const eligible = INTEGRATION_USER_MAPPINGS.filter((mapping) => mapping.bookingEligible)
  assert.equal(eligible.length, 8)
  assert.ok(eligible.every((mapping) => mapping.team !== 'front_desk'))
  assert.ok(INTEGRATION_USER_MAPPINGS.filter((mapping) => mapping.team === 'front_desk')
    .every((mapping) => !mapping.bookingEligible))
})

test('Alice and Aline resolve through one explicit cross-system identity', () => {
  const alice = findEligibleUserByHubSpotUserId(62115861)
  assert.equal(alice?.respondUserId, 985768)
  assert.equal(alice?.respondEmail, 'alice@dharmanutritionclinic.com')
  assert.equal(alice?.hubspotEmail, 'astrelow@dharmanutritionclinic.com')
  assert.ok(alice?.aliases.includes('Aline'))
  assert.ok(alice?.aliases.includes('Aline Strelow'))
})

test('unknown and Front Desk HubSpot users cannot resolve as eligible', () => {
  assert.equal(findEligibleUserByHubSpotUserId(80079886), undefined)
  assert.equal(findEligibleUserByHubSpotUserId(999999999), undefined)
})
