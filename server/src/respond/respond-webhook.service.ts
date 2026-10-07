import { conversationService, CustomerMessageNotUnderstoodError } from '../services/conversation.service.js'
import { RespondClient } from '../integrations/respond/respond.client.js'
import { isRespondChannelEnabled } from '../admin/respond-channel.service.js'
import { getContactAutomation, lockBookedContact, mariaMayRespond, markMariaGreetingSent, resetGenerationIsCurrent, restoreLockedOwner, transferToFrontDesk } from './contact-automation.service.js'
import { initialGreetingForLanguage } from '../services/conversation.service.js'
import { getRespondConversationId, resetRespondConversationSession, setRespondConversationId } from './respond-session.service.js'
import { findEligibleUserByHubSpotUserId } from '../integrations/user-mapping/user-mapping.js'
import { bookingVideo, sendMediaWithoutBlockingText, welcomeImage } from './respond-media.js'
import { detectCustomerLanguage } from '../services/maria.service.js'
import type { RespondMessage } from '../integrations/respond/respond.client.js'

type Json = Record<string, unknown>

export const RESPOND_WORKFLOW_GRACE_PERIOD_MS = 20_000

type Wait = (milliseconds: number) => Promise<void>

const wait: Wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function contactAfterWorkflowGracePeriod<T>(
  loadContact: () => Promise<T>,
  waitForWorkflows: Wait = wait,
) {
  await waitForWorkflows(RESPOND_WORKFLOW_GRACE_PERIOD_MS)
  return loadContact()
}

export function incomingEventIsStillLatest(messages: RespondMessage[], incomingMessageId: string) {
  const latest = messages.reduce<RespondMessage | undefined>((current, message) => (
    !current || message.messageId > current.messageId ? message : current
  ), undefined)
  return !latest || String(latest.messageId) === incomingMessageId
}

export function latestIncomingTextBurst(messages: RespondMessage[], incomingMessageId: string, fallbackText: string) {
  const ordered = [...messages].sort((a, b) => b.messageId - a.messageId)
  if (ordered[0] && String(ordered[0].messageId) !== incomingMessageId) return null
  const texts: string[] = []
  for (const message of ordered) {
    if (message.traffic === 'outgoing') break
    if (message.message.type === 'text' && message.message.text?.trim()) texts.push(message.message.text.trim())
  }
  return texts.reverse().join('\n') || fallbackText
}

function object(value: unknown): Json | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : null }
function first(...values: unknown[]) { return values.find((value) => value !== undefined && value !== null) }
function numeric(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null }

function stringLeaves(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringLeaves)
  const record = object(value)
  return record ? Object.values(record).flatMap(stringLeaves) : []
}

export function parseIncomingWebhook(payload: unknown) {
  const root = object(payload) ?? {}
  const data = object(root.data) ?? root
  const contact = object(first(data.contact, root.contact)) ?? {}
  const message = object(first(data.message, root.message)) ?? {}
  const channel = object(first(data.channel, root.channel, message.channel)) ?? {}
  const content = object(message.content)
  const attachments = Array.isArray(message.attachments) ? message.attachments : []
  const mediaDescriptors = [message.type, content?.type, ...attachments.flatMap(stringLeaves)]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
  const assignee = first(contact.assignee, data.assignee, root.assignee)
  const assigneeObject = object(assignee)
  return {
    contactId: String(first(contact.id, data.contactId, root.contactId, '')),
    contactName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || undefined,
    channelId: numeric(first(channel.id, message.channelId, data.channelId, root.channelId)),
    messageId: String(first(message.id, message.messageId, data.messageId, root.messageId, '')),
    messageType: String(first(message.type, content?.type, data.messageType, root.messageType, '')).toLowerCase(),
    text: String(first(message.text, content?.text, object(message.message)?.text, data.text, root.text, typeof message.content === 'string' ? message.content : undefined, '')),
    hasAttachments: attachments.length > 0,
    hasTransferableMedia: /(?:^|[\s/_.-])(?:image|photo|audio|voice)(?:$|[\s/_.-])/.test(mediaDescriptors),
    isUnassigned: assignee === null || assignee === undefined || assignee === '' || assigneeObject?.id === null,
  }
}

function unsupported(type: string, hasTransferableMedia: boolean) {
  if (hasTransferableMedia) return true
  return ['image', 'audio', 'voice'].some((value) => type.includes(value))
}

export function isPlatformUnsupportedPlaceholder(text: string) {
  return /^\s*unsupported message\s*$/i.test(text)
}

export function payloadContainsPlatformUnsupportedPlaceholder(payload: unknown) {
  return stringLeaves(payload).some(isPlatformUnsupportedPlaceholder)
}

export function inferredLanguage(contactLanguage: string | null | undefined, text: string): 'en' | 'es' | 'pt' {
  if (contactLanguage === 'es' || contactLanguage === 'pt' || contactLanguage === 'en') return contactLanguage
  if (/(?:^|\s)(?:hola|buenas|buenos días|buenas tardes)(?=\s|[!?.,¡¿]|$)/i.test(text)) return 'es'
  if (/(?:^|\s)(?:olá|oi|bom dia|boa tarde)(?=\s|[!?.,¡¿]|$)/i.test(text)) return 'pt'
  if (/(?:^|\s)(?:hello|hi|hey|good morning|good afternoon)(?=\s|[!?.,]|$)/i.test(text)) return 'en'
  return 'es'
}

export async function processIncomingWebhook(
  payload: unknown,
  client = new RespondClient(),
  waitForWorkflows: Wait = wait,
) {
  const event = parseIncomingWebhook(payload)
  if (!event.contactId || !event.channelId) throw new Error('Respond webhook is missing contact or channel ID')
  if (!await isRespondChannelEnabled(event.channelId)) return { action: 'channel_disabled' }

  // Instagram can emit a synthetic placeholder in a nested field while leaving
  // the normal text field empty. It is platform noise, not customer media.
  if (payloadContainsPlatformUnsupportedPlaceholder(payload)) return { action: 'platform_placeholder_ignored' }

  // Ignore delivery/status/unknown events that contain neither text nor media.
  if (!event.text.trim() && !event.hasTransferableMedia) return { action: 'empty_event_ignored' }

  const identifier = `id:${event.contactId}`

  // Respond.io routing, language, lead-status, and bot workflows run
  // asynchronously after an incoming message. Give them time to finish, then
  // read the contact again so Maria does not race an assignment or bot reply.
  const liveContact = await contactAfterWorkflowGracePeriod(
    () => client.getContact(identifier),
    waitForWorkflows,
  ) as { assignee?: unknown; firstName?: string; lastName?: string; language?: string | null }

  const recentMessages = await client.listMessagesPage(identifier, 10)
  if (!incomingEventIsStillLatest(recentMessages.items, event.messageId)) {
    return { action: 'superseded_during_grace_period' }
  }
  const customerText = latestIncomingTextBurst(recentMessages.items, event.messageId, event.text)
  if (customerText === null) return { action: 'superseded_during_grace_period' }
  const isUnassigned = liveContact.assignee === null || liveContact.assignee === undefined
  if (await restoreLockedOwner(event.contactId, isUnassigned, client)) return { action: 'owner_restored' }
  if (!isUnassigned) return { action: 'human_assigned' }

  if (unsupported(event.messageType, event.hasTransferableMedia)) {
    await transferToFrontDesk(event.contactId, event.contactName, client)
    return { action: 'front_desk' }
  }
  const control = await getContactAutomation(event.contactId)
  if (!mariaMayRespond(control, true)) return { action: 'locked' }

  if (!control?.maria_greeting_sent_at) {
    const detectedLanguage = await detectCustomerLanguage(customerText)
    const language = detectedLanguage === 'other'
      ? liveContact.language === 'es' || liveContact.language === 'pt' || liveContact.language === 'en'
        ? liveContact.language
        : 'es'
      : detectedLanguage
    const claimed = await markMariaGreetingSent(event.contactId, event.contactName, control?.reset_at ?? null)
    if (!claimed) return { action: 'stale_after_reset' }
    if (liveContact.language !== language) await client.updateContactLanguage(identifier, language)
    await sendMediaWithoutBlockingText(client, identifier, welcomeImage)
    await client.sendTextMessage(identifier, initialGreetingForLanguage(language))
    return { action: 'greeted' }
  }

  let conversationId = getRespondConversationId(event.contactId, control?.reset_at ?? null)
  if (!conversationId) {
    const startingLanguage = liveContact.language === 'es' || liveContact.language === 'pt' || liveContact.language === 'en'
      ? liveContact.language
      : inferredLanguage(null, customerText)
    conversationId = conversationService.createConversation(startingLanguage).id
    setRespondConversationId(event.contactId, conversationId, control?.reset_at ?? null)
  }
  let result
  try {
    result = await conversationService.processMessage(conversationId, customerText)
  } catch (cause) {
    if (!(cause instanceof CustomerMessageNotUnderstoodError)) throw cause
    resetRespondConversationSession(event.contactId)
    await transferToFrontDesk(event.contactId, event.contactName, client)
    return { action: 'front_desk_unintelligible_text' }
  }
  if (!await resetGenerationIsCurrent(event.contactId, control?.reset_at ?? null)) {
    resetRespondConversationSession(event.contactId)
    return { action: 'stale_after_reset' }
  }
  const detectedLanguage = result.state.preferredLanguage
  if (liveContact.language !== detectedLanguage && (detectedLanguage === 'en' || detectedLanguage === 'es' || detectedLanguage === 'pt')) {
    await client.updateContactLanguage(identifier, detectedLanguage)
  }
  if (result.plan.bookingDetailsComplete) {
    await sendMediaWithoutBlockingText(client, identifier, bookingVideo)
  }
  await client.sendTextMessage(identifier, result.reply)
  if (result.plan.bookingDetailsComplete && result.plan.bookingFinancingMessage) {
    await client.sendTextMessage(identifier, result.plan.bookingFinancingMessage)
    const slot = result.state.selectedAppointmentSlot
    const owner = slot ? findEligibleUserByHubSpotUserId(slot.hubspotUserId) : undefined
    if (!slot || !owner) throw new Error('Completed booking has no eligible Respond.io owner')
    await lockBookedContact({
      contactId: event.contactId,
      contactName: event.contactName,
      respondUserId: owner.respondUserId,
      ownerName: owner.canonicalName,
      language: result.state.preferredLanguage === 'es' || result.state.preferredLanguage === 'pt' ? result.state.preferredLanguage : 'en',
      startTime: slot.startTime,
      endTime: slot.endTime,
    })
    await client.assignConversation(identifier, owner.respondUserId)
    await client.updateContactCustomFields(identifier, { lead_status: 'Evaluation Scheduled' })
    await client.setConversationStatus(identifier, 'close')
    resetRespondConversationSession(event.contactId)
    return { action: 'booking_completed' }
  }
  return { action: 'replied' }
}
