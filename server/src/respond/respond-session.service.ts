import type { ConversationPersonality } from '../domain/conversation.js'

type RespondSession = { conversationId: string; resetAt: string | null; personality: ConversationPersonality }
const conversations = new Map<string, RespondSession>()

export function getRespondConversationId(contactId: string, resetAt: string | null, personality: ConversationPersonality = 'maria') {
  const session = conversations.get(contactId)
  if (!session || session.resetAt !== resetAt || session.personality !== personality) {
    conversations.delete(contactId)
    return undefined
  }
  return session.conversationId
}

export function setRespondConversationId(contactId: string, conversationId: string, resetAt: string | null, personality: ConversationPersonality = 'maria') {
  conversations.set(contactId, { conversationId, resetAt, personality })
}

export function resetRespondConversationSession(contactId: string) {
  conversations.delete(contactId)
}
