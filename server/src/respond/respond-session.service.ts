const conversations = new Map<string, string>()

export function getRespondConversationId(contactId: string) {
  return conversations.get(contactId)
}

export function setRespondConversationId(contactId: string, conversationId: string) {
  conversations.set(contactId, conversationId)
}

export function resetRespondConversationSession(contactId: string) {
  conversations.delete(contactId)
}
