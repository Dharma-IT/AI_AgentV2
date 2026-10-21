import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findEligibleUserByHubSpotUserId,
  INTEGRATION_USER_MAPPINGS,
} from '../src/integrations/user-mapping/user-mapping.js'

test('only Sales and Customer Service users are booking eligible', () => {
  const eligible = INTEGRATION_USER_MAPPINGS.filter((mapping) => mapping.bookingEligible)
  assert.equal(eligible.length, 9)
  assert.ok(eligible.every((mapping) => mapping.team !== 'front_desk'))
  assert.ok(INTEGRATION_USER_MAPPINGS.filter((mapping) => mapping.team === 'front_desk')
    .every((mapping) => !mapping.bookingEligible))
})

test('Helen Gutierrez resolves as a sales seller across all integrations', () => {
  const helen = findEligibleUserByHubSpotUserId(101586321)
  assert.equal(helen?.team, 'sales')
  assert.equal(helen?.respondUserId, 76251601)
  assert.equal(helen?.aircallUserId, 2102686)
  assert.equal(helen?.hubspotEmail, 'hgutierrez@dharmanutritionclinic.com')
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
