type RespondSession = { conversationId: string; resetAt: string | null }
const conversations = new Map<string, RespondSession>()

export function getRespondConversationId(contactId: string, resetAt: string | null) {
  const session = conversations.get(contactId)
  if (!session || session.resetAt !== resetAt) {
    conversations.delete(contactId)
    return undefined
  }
  return session.conversationId
}

export function setRespondConversationId(contactId: string, conversationId: string, resetAt: string | null) {
  conversations.set(contactId, { conversationId, resetAt })
}

export function resetRespondConversationSession(contactId: string) {
  conversations.delete(contactId)
}
