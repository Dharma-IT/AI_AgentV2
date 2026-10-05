import type { ConversationState, MessageAnalysis } from '../domain/conversation.js'

export const semanticSourceTypes = ['conversation_knowledge', 'objection_handling', 'conversation_scenarios'] as const
export type SemanticSourceType = (typeof semanticSourceTypes)[number]
export type KnowledgeLanguage = 'en' | 'es' | 'pt'

export type KnowledgeItem = {
  id: string
  category: string
  content: string
  method: 'structured' | 'semantic'
  sourceType: string
  similarity?: number
  attributes?: Record<string, unknown>
}

export type KnowledgeContext = {
  requestId: string
  language: KnowledgeLanguage
  structured: KnowledgeItem[]
  guidance: KnowledgeItem[]
  compliance: KnowledgeItem[]
  metadata: {
    durationMs: number
    categories: string[]
    recordIds: string[]
    noRelevantKnowledge: boolean
    errors: string[]
  }
}

export type RetrievalInput = {
  message: string
  state: ConversationState
  analysis: MessageAnalysis
}

export type EmbeddingSyncResult = {
  sourceType: SemanticSourceType
  sourceId: string
  status: 'ready' | 'unchanged' | 'excluded' | 'failed'
  error?: string
}
