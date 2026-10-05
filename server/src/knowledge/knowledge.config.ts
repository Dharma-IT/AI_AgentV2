import { env } from '../config/env.js'

export const knowledgeConfig = {
  embeddingModel: env.OPENAI_EMBEDDING_MODEL,
  embeddingDimensions: 1536,
  semanticLimit: 4,
  structuredLimitPerCategory: 5,
  similarityThreshold: 0.38,
  maximumContextCharacters: 14_000,
  debug: process.env.KNOWLEDGE_DEBUG === 'true' && env.NODE_ENV !== 'production',
} as const

