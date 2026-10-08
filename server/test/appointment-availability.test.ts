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

test('a requested weekday offers one morning and one afternoon slot on that day', async () => {
  const startsBySlug: Record<string, string[]> = {
    'arles-martinez': ['2026-10-08T14:00:00.000Z', '2026-10-09T13:40:00.000Z'],
    'brayam-zuluaga': ['2026-10-09T19:00:00.000Z'],
  }
  const client = {
    async getAvailability(slug: string): Promise<HubSpotAvailability> {
      const starts = startsBySlug[slug] ?? []
      return { linkAvailability: { linkAvailabilityByDuration: {
        '1200000': { meetingDurationMillis: 1_200_000, availabilities: starts.map((start) => ({ startMillisUtc: millis(start), endMillisUtc: millis(start) + 1_200_000 })) },
      } } }
    },
  } as Pick<HubSpotClient, 'getAvailability'>
  const slots = await findAppointmentAvailability(
    { stateCode: 'FL', city: 'miami', preference: 'I am only available Friday' },
    client,
    millis('2026-10-05T12:00:00.000Z'),
  )
  assert.deepEqual(slots.map((slot) => slot.startTime), [
    '2026-10-09T13:40:00.000Z',
    '2026-10-09T19:00:00.000Z',
  ])
})

test('requesting another date excludes every previously offered local date', async () => {
  const client = {
    async getAvailability() {
      return { linkAvailability: { linkAvailabilityByDuration: { '1200000': { availabilities: [
        { startMillisUtc: Date.parse('2026-10-09T13:40:00.000Z'), endMillisUtc: Date.parse('2026-10-09T14:00:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-10T14:20:00.000Z'), endMillisUtc: Date.parse('2026-10-10T14:40:00.000Z') },
      ] } } } }
    },
  } as Pick<HubSpotClient, 'getAvailability'>
  const slots = await findAppointmentAvailability(
    { stateCode: 'FL', preference: 'Otra fecha', excludeLocalDates: ['2026-10-09'] },
    client,
    Date.parse('2026-10-08T12:00:00.000Z'),
  )
  assert.ok(slots.length > 0)
  assert.ok(slots.every((slot) => slot.startTime.startsWith('2026-10-10')))
})

test('an unavailable explicit time returns the two closest slots on the requested weekday', async () => {
  const client = {
    async getAvailability() {
      return { linkAvailability: { linkAvailabilityByDuration: { '1200000': { availabilities: [
        { startMillisUtc: Date.parse('2026-10-09T19:00:00.000Z'), endMillisUtc: Date.parse('2026-10-09T19:20:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-09T19:40:00.000Z'), endMillisUtc: Date.parse('2026-10-09T20:00:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-09T20:20:00.000Z'), endMillisUtc: Date.parse('2026-10-09T20:40:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-10T20:00:00.000Z'), endMillisUtc: Date.parse('2026-10-10T20:20:00.000Z') },
      ] } } } }
    },
  } as Pick<HubSpotClient, 'getAvailability'>
  const slots = await findAppointmentAvailability(
    { stateCode: 'FL', preference: 'I am only available Friday at 4:00 PM' },
    client,
    Date.parse('2026-10-08T12:00:00.000Z'),
  )
  assert.deepEqual(slots.map((slot) => slot.startTime), [
    '2026-10-09T19:40:00.000Z',
    '2026-10-09T20:20:00.000Z',
  ])
})

test('an exact explicit weekday and time is offered without fallback slots', async () => {
  const client = {
    async getAvailability() {
      return { linkAvailability: { linkAvailabilityByDuration: { '1200000': { availabilities: [
        { startMillisUtc: Date.parse('2026-10-09T19:40:00.000Z'), endMillisUtc: Date.parse('2026-10-09T20:00:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-09T20:00:00.000Z'), endMillisUtc: Date.parse('2026-10-09T20:20:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-09T20:20:00.000Z'), endMillisUtc: Date.parse('2026-10-09T20:40:00.000Z') },
      ] } } } }
    },
  } as Pick<HubSpotClient, 'getAvailability'>
  const slots = await findAppointmentAvailability(
    { stateCode: 'FL', preference: 'Friday 4:00 PM' },
    client,
    Date.parse('2026-10-08T12:00:00.000Z'),
  )
  assert.deepEqual(slots.map((slot) => slot.startTime), ['2026-10-09T20:00:00.000Z'])
})

test('tomorrow with an explicit time stays on the customer local tomorrow and chooses closest slots', async () => {
  const client = {
    async getAvailability() {
      return { linkAvailability: { linkAvailabilityByDuration: { '1200000': { availabilities: [
        { startMillisUtc: Date.parse('2026-10-08T19:00:00.000Z'), endMillisUtc: Date.parse('2026-10-08T19:20:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-09T18:40:00.000Z'), endMillisUtc: Date.parse('2026-10-09T19:00:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-09T19:20:00.000Z'), endMillisUtc: Date.parse('2026-10-09T19:40:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-10T19:00:00.000Z'), endMillisUtc: Date.parse('2026-10-10T19:20:00.000Z') },
      ] } } } }
    },
  } as Pick<HubSpotClient, 'getAvailability'>
  const slots = await findAppointmentAvailability(
    { stateCode: 'FL', preference: 'I am only available tomorrow at 3:00 PM' },
    client,
    Date.parse('2026-10-08T12:00:00.000Z'),
  )
  assert.deepEqual(slots.map((slot) => slot.startTime), [
    '2026-10-09T18:40:00.000Z',
    '2026-10-09T19:20:00.000Z',
  ])
})

test('today and day-after-tomorrow phrases are hard local-date constraints', async () => {
  const client = {
    async getAvailability() {
      return { linkAvailability: { linkAvailabilityByDuration: { '1200000': { availabilities: [
        { startMillisUtc: Date.parse('2026-10-08T19:00:00.000Z'), endMillisUtc: Date.parse('2026-10-08T19:20:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-09T19:00:00.000Z'), endMillisUtc: Date.parse('2026-10-09T19:20:00.000Z') },
        { startMillisUtc: Date.parse('2026-10-10T19:00:00.000Z'), endMillisUtc: Date.parse('2026-10-10T19:20:00.000Z') },
      ] } } } }
    },
  } as Pick<HubSpotClient, 'getAvailability'>
  const now = Date.parse('2026-10-08T12:00:00.000Z')
  const today = await findAppointmentAvailability({ stateCode: 'FL', preference: '3:00 PM today' }, client, now)
  const nextDay = await findAppointmentAvailability({ stateCode: 'FL', preference: 'pasado mañana' }, client, now)
  assert.deepEqual(today.map((slot) => slot.startTime), ['2026-10-08T19:00:00.000Z'])
  assert.deepEqual(nextDay.map((slot) => slot.startTime), ['2026-10-10T19:00:00.000Z'])
})
