import assert from 'node:assert/strict'
import test from 'node:test'
import { findAppointmentAvailability } from '../src/appointments/availability.service.js'
import { customerTimezoneLabel, resolveCustomerTimezone } from '../src/appointments/timezone.js'
import type { HubSpotAvailability, HubSpotClient } from '../src/integrations/hubspot/hubspot.client.js'

function millis(value: string) { return Date.parse(value) }

test('customer timezone uses recognized city and state context', () => {
  assert.equal(resolveCustomerTimezone('FL', 'miami'), 'America/New_York')
  assert.equal(customerTimezoneLabel('America/New_York', 'miami'), 'Miami Time')
  assert.equal(resolveCustomerTimezone('CA'), 'America/Los_Angeles')
  assert.equal(customerTimezoneLabel('America/Los_Angeles'), 'Pacific Time')
})

test('availability offers one morning and one afternoon verified 20-minute slot for tomorrow', async () => {
  const startsBySlug: Record<string, string[]> = {
    'arles-martinez': ['2026-10-06T14:20:00.000Z'],
    'brayam-zuluaga': ['2026-10-06T15:00:00.000Z'],
    'edmilson-morales': ['2026-10-06T17:20:00.000Z'],
    'alejandra-oyala': ['2026-10-06T15:00:00.000Z'],
  }
  const client = {
    async getAvailability(slug: string): Promise<HubSpotAvailability> {
      const starts = startsBySlug[slug] ?? []
      if (slug === 'alejandra-oyala') return { linkAvailability: { linkAvailabilityByDuration: {
        '1800000': { meetingDurationMillis: 1_800_000, availabilities: starts.map((start) => ({ startMillisUtc: millis(start), endMillisUtc: millis(start) + 1_800_000 })) },
      } } }
      return { linkAvailability: { linkAvailabilityByDuration: {
        '1200000': { meetingDurationMillis: 1_200_000, availabilities: starts.map((start) => ({ startMillisUtc: millis(start), endMillisUtc: millis(start) + 1_200_000 })) },
      } } }
    },
  } as Pick<HubSpotClient, 'getAvailability'>

  const slots = await findAppointmentAvailability(
    { stateCode: 'FL', city: 'miami' },
    client,
    millis('2026-10-05T12:00:00.000Z'),
  )
  assert.deepEqual(slots.map((slot) => slot.startTime), [
    '2026-10-06T14:20:00.000Z',
    '2026-10-06T17:20:00.000Z',
  ])
  assert.deepEqual(slots.map((slot) => slot.hubspotUserId), [77394932, 77394941])
  assert.ok(slots.every((slot) => slot.timezoneLabel === 'Miami Time'))
})

test('an explicit requested time is preferred when it is available', async () => {
  const client = {
    async getAvailability(slug: string): Promise<HubSpotAvailability> {
      if (slug !== 'arles-martinez') return { linkAvailability: { linkAvailabilityByDuration: {} } }
      return { linkAvailability: { linkAvailabilityByDuration: {
        '1200000': { meetingDurationMillis: 1_200_000, availabilities: [
          { startMillisUtc: millis('2026-10-06T14:20:00.000Z'), endMillisUtc: millis('2026-10-06T14:40:00.000Z') },
          { startMillisUtc: millis('2026-10-06T16:20:00.000Z'), endMillisUtc: millis('2026-10-06T16:40:00.000Z') },
        ] },
      } } }
    },
  } as Pick<HubSpotClient, 'getAvailability'>
  const slots = await findAppointmentAvailability(
    { stateCode: 'FL', city: 'miami', preference: 'Tomorrow at 12:20 PM' },
    client,
    millis('2026-10-05T12:00:00.000Z'),
  )
  assert.deepEqual(slots.map((slot) => slot.startTime), ['2026-10-06T16:20:00.000Z'])
})
