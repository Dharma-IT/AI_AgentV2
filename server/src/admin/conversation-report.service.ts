import { RespondClient, type RespondContact, type RespondMessage } from '../integrations/respond/respond.client.js'

const EASTERN_TIMEZONE = 'America/New_York'
const BOOKING_CONFIRMATION = /(?:your free informational video call is scheduled for|su videollamada informativa gratuita est(?:á|a) programada para|sua videochamada informativa gratuita est(?:á|a) agendada para)/i

type ReportConversation = {
  contactId: number
  contactName: string
  channelId: number
  firstRepliedAt: string
  lastRepliedAt: string
  replies: number
  latestReply: string
  booked: boolean
}

export type ConversationReport = {
  timezone: typeof EASTERN_TIMEZONE
  from: string
  to: string
  generatedAt: string
  stats: { conversations: number; totalReplies: number; averageReplies: number; successfulBookings: number }
  hourly: Array<{ hour: number; label: string; count: number }>
  channels: Array<{ channelId: number; channelName: string; count: number }>
  conversations: ReportConversation[]
}

function cursorFrom(next?: string | null) {
  if (!next) return undefined
  try { return new URL(next).searchParams.get('cursorId') ?? undefined } catch { return undefined }
}

function messageTime(message: RespondMessage) {
  const sent = message.status?.find((entry) => entry.value === 'sent' && entry.timestamp)?.timestamp
  return sent ?? Math.floor(Number(message.messageId) / 1000)
}

function easternParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(timestamp)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour) % 24 }
}

function inEasternRange(timestamp: number, from: string, to: string) {
  const date = easternParts(timestamp).date
  return date >= from && date <= to
}

function olderThanRange(timestamp: number, from: string) { return easternParts(timestamp).date < from }

async function allContacts(client: RespondClient) {
  const contacts: RespondContact[] = []
  let cursor: string | undefined
  do {
    const page = await client.listContactsPage(100, cursor)
    contacts.push(...page.items)
    cursor = cursorFrom(page.pagination?.next)
  } while (cursor)
  return contacts
}

async function repliesForContact(client: RespondClient, contact: RespondContact, from: string, to: string): Promise<ReportConversation | null> {
  const replies: Array<{ message: RespondMessage; time: number }> = []
  let cursor: string | undefined
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const page = await client.listMessagesPage(`id:${contact.id}`, 100, cursor)
    for (const message of page.items) {
      const time = messageTime(message)
      if (message.traffic === 'outgoing' && message.sender?.source === 'api' && inEasternRange(time, from, to)) replies.push({ message, time })
    }
    const oldest = page.items.length ? Math.min(...page.items.map(messageTime)) : Number.POSITIVE_INFINITY
    cursor = cursorFrom(page.pagination?.next)
    if (!cursor || olderThanRange(oldest, from)) break
  }
  if (!replies.length) return null
  replies.sort((left, right) => left.time - right.time)
  const latest = replies.at(-1)!.message
  const latestText = latest.message.text?.trim() || `[${latest.message.attachment?.type ?? latest.message.type}]`
  return {
    contactId: contact.id,
    contactName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || `Contact ${contact.id}`,
    channelId: latest.channelId,
    firstRepliedAt: new Date(replies[0]!.time).toISOString(),
    lastRepliedAt: new Date(replies.at(-1)!.time).toISOString(),
    replies: replies.length,
    latestReply: latestText,
    booked: replies.some(({ message }) => BOOKING_CONFIRMATION.test(message.message.text ?? '')),
  }
}

async function pooledMap<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index]!) }
  }))
  return results
}

const cache = new Map<string, { expiresAt: number; report: ConversationReport }>()
const jobs = new Map<string, { status: 'pending' | 'failed'; error?: string }>()

export async function getConversationReport(from: string, to: string, client = new RespondClient()): Promise<ConversationReport> {
  const key = `${from}:${to}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.report
  const [contacts, channels] = await Promise.all([allContacts(client), client.listChannels()])
  const rows = (await pooledMap(contacts, 20, (contact) => repliesForContact(client, contact, from, to)))
    .filter((row): row is ReportConversation => Boolean(row))
    .sort((left, right) => right.lastRepliedAt.localeCompare(left.lastRepliedAt))
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, label: new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' }).format(Date.UTC(2020, 0, 1, hour)), count: 0 }))
  const channelCounts = new Map<number, number>()
  for (const row of rows) {
    hourly[easternParts(Date.parse(row.firstRepliedAt)).hour]!.count += 1
    channelCounts.set(row.channelId, (channelCounts.get(row.channelId) ?? 0) + 1)
  }
  const channelNames = new Map(channels.map((channel) => [channel.id, channel.name]))
  const totalReplies = rows.reduce((sum, row) => sum + row.replies, 0)
  const report: ConversationReport = {
    timezone: EASTERN_TIMEZONE, from, to, generatedAt: new Date().toISOString(),
    stats: { conversations: rows.length, totalReplies, averageReplies: rows.length ? Number((totalReplies / rows.length).toFixed(1)) : 0, successfulBookings: rows.filter((row) => row.booked).length },
    hourly,
    channels: [...channelCounts].map(([channelId, count]) => ({ channelId, channelName: channelNames.get(channelId) ?? `Channel ${channelId}`, count })).sort((a, b) => b.count - a.count),
    conversations: rows,
  }
  cache.set(key, { expiresAt: Date.now() + 5 * 60_000, report })
  return report
}

export function requestConversationReport(from: string, to: string) {
  const key = `${from}:${to}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return { status: 'ready' as const, report: cached.report }
  const existing = jobs.get(key)
  if (existing) return existing.status === 'failed'
    ? { status: 'failed' as const, error: existing.error ?? 'Respond.io report generation failed' }
    : { status: 'pending' as const }
  jobs.set(key, { status: 'pending' })
  void getConversationReport(from, to)
    .then(() => { jobs.delete(key) })
    .catch((error: unknown) => { jobs.set(key, { status: 'failed', error: error instanceof Error ? error.message : 'Respond.io report generation failed' }) })
  return { status: 'pending' as const }
}
