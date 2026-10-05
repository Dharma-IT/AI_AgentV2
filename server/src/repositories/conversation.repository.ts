import type { ConversationState } from '../domain/conversation.js'

export interface ConversationRepository {
  create(state: ConversationState): void
  findById(id: string): ConversationState | undefined
  save(state: ConversationState): void
}

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, ConversationState>()

  create(state: ConversationState) {
    this.conversations.set(state.id, structuredClone(state))
  }

  findById(id: string) {
    const state = this.conversations.get(id)
    return state ? structuredClone(state) : undefined
  }

  save(state: ConversationState) {
    this.conversations.set(state.id, structuredClone(state))
  }
}

export const conversationRepository = new InMemoryConversationRepository()
