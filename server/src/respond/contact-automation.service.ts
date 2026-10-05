import { supabaseAdminClient } from '../lib/supabase.js'
import { RespondClient } from '../integrations/respond/respond.client.js'
import { INTEGRATION_USER_MAPPINGS } from '../integrations/user-mapping/user-mapping.js'
import { DatabaseOperationError } from '../admin/commercial.service.js'
import { resetRespondConversationSession } from './respond-session.service.js'

export type ContactAutomation = {
  id: string
  respond_contact_id: string
  contact_name: string | null
  mode: 'maria' | 'booked_agent' | 'front_desk'
  owner_respond_user_id: number | null
  owner_name: string | null
  preferred_language: 'en' | 'es' | 'pt' | null
  evaluation_start_at: string | null
  evaluation_end_at: string | null
  locked_until: string | null
  last_action: string | null
  maria_greeting_sent_at: string | null
  reset_at: string | null
  updated_at: string
}

function database() {
  if (!supabaseAdminClient) throw new DatabaseOperationError('Database is not configured')
  return supabaseAdminClient
}

export async function listContactAutomation(search = '') {
  let query = database().from('respond_contact_automation').select('*').order('updated_at', { ascending: false }).limit(100)
  if (search.trim()) query = query.or(`respond_contact_id.ilike.%${search.trim()}%,contact_name.ilike.%${search.trim()}%,owner_name.ilike.%${search.trim()}%`)
  const result = await query
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as ContactAutomation[]
}

export function contactNeedsUnassignment(contact: { assignee?: unknown }) {
  return contact.assignee !== null && contact.assignee !== undefined
}

export async function searchContactControls(search: string, client = new RespondClient()) {
  if (!search.trim()) return listContactAutomation()
  const normalizedSearch = search.trim()
  const directContact = /^\d+$/.test(normalizedSearch)
    ? await client.getContact(`id:${normalizedSearch}`) as {
        id: number; firstName: string | null; lastName: string | null; phone: string | null
        email: string | null; status: string; assignee: { firstName: string; lastName: string } | null
      }
    : null
  const [contacts, controls] = await Promise.all([
    directContact ? Promise.resolve([directContact]) : client.searchContacts(normalizedSearch),
    listContactAutomation(),
  ])
  const controlsById = new Map(controls.map((control) => [control.respond_contact_id, control]))
  return contacts.map((contact) => {
    const control = controlsById.get(String(contact.id))
    const assigneeName = contact.assignee ? `${contact.assignee.firstName} ${contact.assignee.lastName}`.trim() : null
    return {
      respond_contact_id: String(contact.id),
      contact_name: `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || contact.email || contact.phone,
      mode: control?.mode ?? 'maria',
      owner_name: control?.owner_name ?? assigneeName,
      locked_until: control?.locked_until ?? null,
      last_action: control?.last_action ?? null,
      respond_status: contact.status,
      currently_assigned: Boolean(contact.assignee),
    }
  })
}

export async function resetContactToMaria(
  contactId: string,
  adminId: string,
  client: Pick<RespondClient, 'getContact' | 'unassignConversation'> = new RespondClient(),
) {
  const now = new Date().toISOString()
  const result = await database().from('respond_contact_automation').upsert({
    respond_contact_id: contactId,
    mode: 'maria', owner_respond_user_id: null, owner_name: null,
    evaluation_start_at: null, evaluation_end_at: null, locked_until: null,
    last_action: 'manual_admin_reset', maria_greeting_sent_at: null, reset_by: adminId, reset_at: now,
  }, { onConflict: 'respond_contact_id' }).select('*').single()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  resetRespondConversationSession(contactId)
  try {
    const contact = await client.getContact(`id:${contactId}`) as { assignee?: unknown }
    if (contactNeedsUnassignment(contact)) await client.unassignConversation(`id:${contactId}`)
  } catch (error) {
    console.error('Respond contact was reset, but assignment synchronization failed', error instanceof Error ? error.message : error)
  }
  return result.data as ContactAutomation
}

export async function lockBookedContact(input: {
  contactId: string; contactName?: string; respondUserId: number; ownerName: string
  language: 'en' | 'es' | 'pt'; startTime: string; endTime: string
}) {
  const lockedUntil = new Date(Date.parse(input.endTime) + 24 * 60 * 60 * 1000).toISOString()
  const result = await database().from('respond_contact_automation').upsert({
    respond_contact_id: input.contactId, contact_name: input.contactName ?? null,
    mode: 'booked_agent', owner_respond_user_id: input.respondUserId, owner_name: input.ownerName,
    preferred_language: input.language, evaluation_start_at: input.startTime,
    evaluation_end_at: input.endTime, locked_until: lockedUntil, last_action: 'booking_completed',
  }, { onConflict: 'respond_contact_id' }).select('*').single()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as ContactAutomation
}

export async function transferToFrontDesk(contactId: string, contactName?: string, client = new RespondClient()) {
  const pool = INTEGRATION_USER_MAPPINGS.filter((entry) => entry.team === 'front_desk')
  const claimed = await database().rpc('claim_next_front_desk_index', { pool_size: pool.length })
  if (claimed.error) throw new DatabaseOperationError(claimed.error.message, claimed.error.code)
  const owner = pool[Number(claimed.data) % pool.length]!
  await client.assignConversation(`id:${contactId}`, owner.respondUserId)
  const result = await database().from('respond_contact_automation').upsert({
    respond_contact_id: contactId, contact_name: contactName ?? null, mode: 'front_desk',
    owner_respond_user_id: owner.respondUserId, owner_name: owner.canonicalName,
    locked_until: null, last_action: 'front_desk_handoff',
  }, { onConflict: 'respond_contact_id' }).select('*').single()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as ContactAutomation
}

export async function getContactAutomation(contactId: string) {
  const result = await database().from('respond_contact_automation').select('*').eq('respond_contact_id', contactId).maybeSingle()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as ContactAutomation | null
}

export async function markMariaGreetingSent(contactId: string, contactName: string | undefined, expectedResetAt: string | null) {
  const now = new Date().toISOString()
  let query = database().from('respond_contact_automation').update({
    contact_name: contactName ?? null, mode: 'maria', maria_greeting_sent_at: now,
    last_action: 'maria_greeting_sent',
  }).eq('respond_contact_id', contactId)
  query = expectedResetAt === null ? query.is('reset_at', null) : query.eq('reset_at', expectedResetAt)
  const result = await query.select('*').maybeSingle()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  if (result.data) return result.data as ContactAutomation
  const existing = await getContactAutomation(contactId)
  if (existing) return null
  const inserted = await database().from('respond_contact_automation').insert({
    respond_contact_id: contactId, contact_name: contactName ?? null, mode: 'maria',
    maria_greeting_sent_at: now, last_action: 'maria_greeting_sent',
  }).select('*').single()
  if (inserted.error) throw new DatabaseOperationError(inserted.error.message, inserted.error.code)
  return inserted.data as ContactAutomation
}

export async function resetGenerationIsCurrent(contactId: string, expectedResetAt: string | null) {
  const latest = await getContactAutomation(contactId)
  return (latest?.reset_at ?? null) === expectedResetAt
}

export function mariaMayRespond(record: ContactAutomation | null, isUnassigned: boolean, now = Date.now()) {
  if (!isUnassigned) return false
  if (!record || record.mode === 'maria') return true
  return record.mode === 'booked_agent' && Boolean(record.locked_until) && Date.parse(record.locked_until!) <= now
}

export async function restoreLockedOwner(contactId: string, isUnassigned: boolean, client = new RespondClient()) {
  const record = await getContactAutomation(contactId)
  if (!record || !isUnassigned || !record.owner_respond_user_id) return false
  if (record.mode === 'booked_agent' && record.locked_until && Date.parse(record.locked_until) <= Date.now()) return false
  if (record.mode !== 'booked_agent' && record.mode !== 'front_desk') return false
  await client.assignConversation(`id:${contactId}`, record.owner_respond_user_id)
  return true
}
