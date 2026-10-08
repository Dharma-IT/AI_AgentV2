import type { AppointmentSlot } from '../domain/conversation.js'
import { HubSpotClient } from '../integrations/hubspot/hubspot.client.js'
import { findEligibleUserByHubSpotUserId } from '../integrations/user-mapping/user-mapping.js'
import { customerTimezoneLabel, resolveCustomerTimezone } from './timezone.js'

const REQUIRED_DURATION_MS = 20 * 60 * 1000
const meetingPool = [
  { hubspotUserId: 99223316, slug: 'alejandra-oyala' },
  { hubspotUserId: 100293115, slug: 'cvargas37' },
  { hubspotUserId: 77394932, slug: 'arles-martinez' },
  { hubspotUserId: 79527842, slug: 'brayam-zuluaga' },
  { hubspotUserId: 77394941, slug: 'edmilson-morales' },
  { hubspotUserId: 62115861, slug: 'aline-strelow' },
] as const

type AvailabilityInput = {
  stateCode: string
  city?: string | null
  preference?: string | null
  excludeLocalDates?: string[]
}

function localParts(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(timestamp)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function dateKey(timestamp: number, timezone: string) {
  const value = localParts(timestamp, timezone)
  return `${value.year}-${value.month}-${value.day}`
}

function addDaysToDateKey(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10)
}

function requestedRelativeDateKey(preference: string | null | undefined, timezone: string, now: number) {
  if (!preference) return null
  const normalized = preference.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US')
  const today = dateKey(now, timezone)
  if (/\b(?:day after tomorrow|pasado manana|depois de amanha)\b/i.test(normalized)) return addDaysToDateKey(today, 2)
  if (/\b(?:tomorrow|next day|manana|amanha)\b/i.test(normalized)) return addDaysToDateKey(today, 1)
  if (/\b(?:today|hoy|hoje)\b/iu.test(normalized)) return today
  return null
}

function preferenceMatches(timestamp: number, timezone: string, preference?: string | null) {
  if (!preference) return true
  const normalized = preference.toLowerCase()
  const parts = localParts(timestamp, timezone)
  const hour = Number(parts.hour) % 24
  const minute = Number(parts.minute)
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(timestamp).toLowerCase()
  const weekdayAliases: Record<string, string[]> = {
    sunday: ['sunday', 'domingo'], monday: ['monday', 'lunes', 'segunda'],
    tuesday: ['tuesday', 'martes', 'terça'], wednesday: ['wednesday', 'miércoles', 'quarta'],
    thursday: ['thursday', 'jueves', 'quinta'], friday: ['friday', 'viernes', 'sexta'],
    saturday: ['saturday', 'sábado'],
  }
  const requestedWeekday = Object.entries(weekdayAliases).find(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))?.[0]
  if (requestedWeekday && weekday !== requestedWeekday) return false
  if (normalized.includes('morning') && hour >= 12) return false
  if (normalized.includes('afternoon') && hour < 12) return false
  const match = normalized.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/)
  if (match) {
    let requestedHour = Number(match[1]) % 12
    if (match[3] === 'pm') requestedHour += 12
    if (hour !== requestedHour || minute !== Number(match[2] ?? 0)) return false
  }
  return true
}

function hasDateConstraint(preference?: string | null) {
  if (!preference) return false
  return /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|domingo|lunes|martes|miércoles|jueves|viernes|sábado|segunda|terça|quarta|quinta|sexta)\b/i.test(preference)
}

function hasTimeConstraint(preference?: string | null) {
  if (!preference) return false
  return /\b(?:morning|afternoon|mañana|tarde|manhã)\b/i.test(preference)
    || /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)\b/i.test(preference)
}

function requestedTimeMinutes(preference?: string | null) {
  if (!preference) return null
  const match = preference.toLowerCase().match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/)
  if (!match) return null
  let hour = Number(match[1]) % 12
  if (match[3] === 'pm') hour += 12
  return hour * 60 + Number(match[2] ?? 0)
}

function withoutExplicitTime(preference: string) {
  return preference.replace(/\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)\b/ig, '')
}

function localMinuteOfDay(slot: AppointmentSlot, timezone: string) {
  const parts = localParts(Date.parse(slot.startTime), timezone)
  return (Number(parts.hour) % 24) * 60 + Number(parts.minute)
}

function chooseTwo(slots: AppointmentSlot[]) {
  const chosen: AppointmentSlot[] = []
  for (const slot of slots) {
    if (chosen.some((item) => item.startTime === slot.startTime)) continue
    if (chosen.length === 1 && chosen[0]?.hubspotUserId === slot.hubspotUserId) continue
    chosen.push(slot)
    if (chosen.length === 2) return chosen
  }
  for (const slot of slots) {
    if (!chosen.some((item) => item.startTime === slot.startTime)) chosen.push(slot)
    if (chosen.length === 2) break
  }
  return chosen
}

function chooseClosestTwo(slots: AppointmentSlot[]) {
  const chosen: AppointmentSlot[] = []
  for (const slot of slots) {
    if (!chosen.some((item) => item.startTime === slot.startTime)) chosen.push(slot)
    if (chosen.length === 2) break
  }
  return chosen
}

function chooseMorningAndAfternoon(slots: AppointmentSlot[], timezone: string) {
  const morning = slots.filter((slot) => Number(localParts(Date.parse(slot.startTime), timezone).hour) % 24 < 12)
  const afternoon = slots.filter((slot) => Number(localParts(Date.parse(slot.startTime), timezone).hour) % 24 >= 12)
  if (!morning.length || !afternoon.length) return chooseTwo(slots)

  const morningSlot = morning[0]!
  const afternoonSlot = afternoon.find((slot) => slot.hubspotUserId !== morningSlot.hubspotUserId) ?? afternoon[0]!
  return [morningSlot, afternoonSlot]
}

export async function findAppointmentAvailability(
  input: AvailabilityInput,
  client: Pick<HubSpotClient, 'getAvailability'> = new HubSpotClient(),
  now = Date.now(),
): Promise<AppointmentSlot[]> {
  const timezone = resolveCustomerTimezone(input.stateCode, input.city)
  const timezoneLabel = customerTimezoneLabel(timezone, input.city)
  const today = localParts(now, timezone)
  const tomorrow = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day) + 1))
  const tomorrowKey = tomorrow.toISOString().slice(0, 10)
  const results = await Promise.allSettled(meetingPool.map(async (member) => {
    if (!findEligibleUserByHubSpotUserId(member.hubspotUserId)) return []
    const availability = await client.getAvailability(member.slug, timezone)
    const duration = availability.linkAvailability?.linkAvailabilityByDuration?.[String(REQUIRED_DURATION_MS)]
    return (duration?.availabilities ?? []).map((slot): AppointmentSlot => ({
      startTime: new Date(slot.startMillisUtc).toISOString(),
      endTime: new Date(slot.endMillisUtc).toISOString(),
      timezone,
      timezoneLabel,
      hubspotUserId: member.hubspotUserId,
      meetingLinkSlug: member.slug,
    }))
  }))
  const all = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .filter((slot) => Date.parse(slot.startTime) > now + 15 * 60 * 1000)
    .filter((slot) => !input.excludeLocalDates?.includes(dateKey(Date.parse(slot.startTime), timezone)))
    .sort((left, right) => left.startTime.localeCompare(right.startTime))
  const requestedDate = requestedRelativeDateKey(input.preference, timezone, now)
  const dateConstrained = requestedDate
    ? all.filter((slot) => dateKey(Date.parse(slot.startTime), timezone) === requestedDate)
    : all
  const preferred = dateConstrained.filter((slot) => preferenceMatches(Date.parse(slot.startTime), timezone, input.preference))
  const requestedMinutes = requestedTimeMinutes(input.preference)
  const closestSlots = requestedMinutes === null
    ? []
    : dateConstrained
      .filter((slot) => preferenceMatches(Date.parse(slot.startTime), timezone, withoutExplicitTime(input.preference!)))
      .sort((left, right) => {
        const distance = Math.abs(localMinuteOfDay(left, timezone) - requestedMinutes)
          - Math.abs(localMinuteOfDay(right, timezone) - requestedMinutes)
        return distance || left.startTime.localeCompare(right.startTime)
      })
  const candidatePool = preferred.length
    ? preferred
    : closestSlots.length
      ? closestSlots
      : hasDateConstraint(input.preference) || requestedDate ? [] : all
  const tomorrowSlots = candidatePool.filter((slot) => dateKey(Date.parse(slot.startTime), timezone) === tomorrowKey)
  const selectedPool = tomorrowSlots.length ? tomorrowSlots : candidatePool
  return hasTimeConstraint(input.preference)
    ? preferred.length ? chooseTwo(selectedPool) : closestSlots.length ? chooseClosestTwo(closestSlots) : chooseTwo(selectedPool)
    : chooseMorningAndAfternoon(selectedPool, timezone)
}
