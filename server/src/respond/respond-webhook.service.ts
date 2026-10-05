import { conversationService } from '../services/conversation.service.js'
import { RespondClient } from '../integrations/respond/respond.client.js'
import { isRespondChannelEnabled } from '../admin/respond-channel.service.js'
import { getContactAutomation, mariaMayRespond, markMariaGreetingSent, resetGenerationIsCurrent, restoreLockedOwner, transferToFrontDesk } from './contact-automation.service.js'
import { initialGreetingForLanguage } from '../services/conversation.service.js'
import { getRespondConversationId, resetRespondConversationSession, setRespondConversationId } from './respond-session.service.js'

type Json = Record<string, unknown>

function object(value: unknown): Json | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : null }
function first(...values: unknown[]) { return values.find((value) => value !== undefined && value !== null) }
function numeric(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null }

export function parseIncomingWebhook(payload: unknown) {
  const root = object(payload) ?? {}
  const data = object(root.data) ?? root
  const contact = object(first(data.contact, root.contact)) ?? {}
  const message = object(first(data.message, root.message)) ?? {}
  const channel = object(first(data.channel, root.channel, message.channel)) ?? {}
  const content = object(message.content)
  const assignee = first(contact.assignee, data.assignee, root.assignee)
  const assigneeObject = object(assignee)
  return {
    contactId: String(first(contact.id, data.contactId, root.contactId, '')),
    contactName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || undefined,
    channelId: numeric(first(channel.id, message.channelId, data.channelId, root.channelId)),
    messageId: String(first(message.id, message.messageId, data.messageId, root.messageId, '')),
    messageType: String(first(message.type, content?.type, data.messageType, root.messageType, '')).toLowerCase(),
    text: String(first(message.text, content?.text, object(message.message)?.text, data.text, root.text, typeof message.content === 'string' ? message.content : undefined, '')),
    hasAttachments: Array.isArray(message.attachments) && message.attachments.length > 0,
    isUnassigned: assignee === null || assignee === undefined || assignee === '' || assigneeObject?.id === null,
  }
}

function unsupported(type: string, text: string, hasAttachments: boolean) {
  if (hasAttachments) return true
  if (['image', 'audio', 'voice', 'video', 'file', 'attachment'].some((value) => type.includes(value))) return true
  return !text.trim()
}

export function isPlatformUnsupportedPlaceholder(text: string) {
  return /^\s*unsupported message\s*$/i.test(text)
}

export async function processIncomingWebhook(payload: unknown, client = new RespondClient()) {
  const event = parseIncomingWebhook(payload)
  if (!event.contactId || !event.channelId) throw new Error('Respond webhook is missing contact or channel ID')
  if (!await isRespondChannelEnabled(event.channelId)) return { action: 'channel_disabled' }

  const identifier = `id:${event.contactId}`
  const liveContact = await client.getContact(identifier) as { assignee?: unknown; firstName?: string; lastName?: string; language?: string | null }
  const isUnassigned = liveContact.assignee === null || liveContact.assignee === undefined
  if (await restoreLockedOwner(event.contactId, isUnassigned, client)) return { action: 'owner_restored' }
  if (!isUnassigned) return { action: 'human_assigned' }

  if (isPlatformUnsupportedPlaceholder(event.text)) return { action: 'platform_placeholder_ignored' }

  if (unsupported(event.messageType, event.text, event.hasAttachments)) {
    await transferToFrontDesk(event.contactId, event.contactName, client)
    return { action: 'front_desk' }
  }
  const control = await getContactAutomation(event.contactId)
  if (!mariaMayRespond(control, true)) return { action: 'locked' }

  if (!control?.maria_greeting_sent_at) {
    const language = liveContact.language === 'es' || liveContact.language === 'pt'
      ? liveContact.language
      : /\b(hola|buenas|buenos días|buenas tardes)\b/i.test(event.text)
        ? 'es'
        : /\b(olá|oi|bom dia|boa tarde)\b/i.test(event.text)
          ? 'pt'
          : 'en'
    const claimed = await markMariaGreetingSent(event.contactId, event.contactName, control?.reset_at ?? null)
    if (!claimed) return { action: 'stale_after_reset' }
    await client.sendTextMessage(identifier, initialGreetingForLanguage(language))
    return { action: 'greeted' }
  }

  let conversationId = getRespondConversationId(event.contactId, control?.reset_at ?? null)
  if (!conversationId) {
    conversationId = conversationService.createConversation().id
    setRespondConversationId(event.contactId, conversationId, control?.reset_at ?? null)
  }
  const result = await conversationService.processMessage(conversationId, event.text)
  if (!await resetGenerationIsCurrent(event.contactId, control?.reset_at ?? null)) {
    resetRespondConversationSession(event.contactId)
    return { action: 'stale_after_reset' }
  }
  await client.sendTextMessage(identifier, result.reply)
  return { action: 'replied' }
}
