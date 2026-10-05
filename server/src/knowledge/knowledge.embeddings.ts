import { createHash } from 'node:crypto'
import { openai } from '../lib/openai.js'
import { supabaseAdminClient } from '../lib/supabase.js'
import { DatabaseOperationError } from '../admin/commercial.service.js'
import { knowledgeConfig } from './knowledge.config.js'
import { semanticSourceTypes, type EmbeddingSyncResult, type KnowledgeLanguage, type SemanticSourceType } from './knowledge.types.js'

type SemanticRecord = Record<string, unknown> & { id: string; status: string; language_code?: string }

function client() {
  if (!supabaseAdminClient) throw new DatabaseOperationError('Database is not configured')
  return supabaseAdminClient
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }

export function semanticContent(sourceType: SemanticSourceType, record: SemanticRecord) {
  if (sourceType === 'conversation_knowledge') {
    return [text(record.title), text(record.description), text(record.category), text(record.content), ...(Array.isArray(record.keywords) ? record.keywords : [])].filter(Boolean).join('\n')
  }
  if (sourceType === 'objection_handling') {
    return [text(record.title), text(record.category), `Customer objection: ${text(record.objection)}`, `Approved guidance: ${text(record.guidance)}`, text(record.follow_up_question), text(record.additional_context), ...(Array.isArray(record.keywords) ? record.keywords : [])].filter(Boolean).join('\n')
  }
  return [text(record.name), text(record.category), text(record.description), `Example customer message: ${text(record.customer_message)}`, text(record.conversation_context), `Expected behavior: ${text(record.expected_behavior)}`, `Response guidance: ${text(record.response_guidance)}`, text(record.expected_next_action), ...(Array.isArray(record.keywords) ? record.keywords : [])].filter(Boolean).join('\n')
}

function hash(content: string) { return createHash('sha256').update(content).digest('hex') }

export async function createEmbedding(input: string) {
  const response = await openai.embeddings.create({ model: knowledgeConfig.embeddingModel, input, encoding_format: 'float' })
  const embedding = response.data[0]?.embedding
  if (!embedding || embedding.length !== knowledgeConfig.embeddingDimensions) throw new Error(`Embedding model returned ${embedding?.length ?? 0} dimensions; expected ${knowledgeConfig.embeddingDimensions}`)
  return embedding
}

export async function removeEmbedding(sourceType: SemanticSourceType, sourceId: string): Promise<EmbeddingSyncResult> {
  const result = await client().from('knowledge_embeddings').delete().eq('source_type', sourceType).eq('source_id', sourceId)
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return { sourceType, sourceId, status: 'excluded' }
}

export async function syncEmbedding(sourceType: SemanticSourceType, record: SemanticRecord): Promise<EmbeddingSyncResult> {
  if (record.status !== 'published') return removeEmbedding(sourceType, record.id)
  const content = semanticContent(sourceType, record)
  const contentHash = hash(`${knowledgeConfig.embeddingModel}\n${record.language_code ?? 'en'}\n${content}`)
  const existing = await client().from('knowledge_embeddings').select('content_hash,status,attempt_count').eq('source_type', sourceType).eq('source_id', record.id).maybeSingle()
  if (existing.error) throw new DatabaseOperationError(existing.error.message, existing.error.code)
  if (existing.data?.content_hash === contentHash && existing.data.status === 'ready') return { sourceType, sourceId: record.id, status: 'unchanged' }

  const base = { source_type: sourceType, source_id: record.id, source_content: content, content_hash: contentHash, language_code: (record.language_code ?? 'en') as KnowledgeLanguage, embedding_model: knowledgeConfig.embeddingModel }
  const pending = await client().from('knowledge_embeddings').upsert({ ...base, status: 'pending', error_message: null, embedding: null }, { onConflict: 'source_type,source_id' })
  if (pending.error) throw new DatabaseOperationError(pending.error.message, pending.error.code)
  try {
    const embedding = await createEmbedding(content)
    const ready = await client().from('knowledge_embeddings').update({ embedding: JSON.stringify(embedding), status: 'ready', error_message: null, embedded_at: new Date().toISOString(), attempt_count: (existing.data?.attempt_count ?? 0) + 1 }).eq('source_type', sourceType).eq('source_id', record.id)
    if (ready.error) throw new DatabaseOperationError(ready.error.message, ready.error.code)
    return { sourceType, sourceId: record.id, status: 'ready' }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 1000) : 'Embedding generation failed'
    await client().from('knowledge_embeddings').update({ status: 'failed', error_message: message, attempt_count: (existing.data?.attempt_count ?? 0) + 1 }).eq('source_type', sourceType).eq('source_id', record.id)
    return { sourceType, sourceId: record.id, status: 'failed', error: message }
  }
}

export async function retryFailedEmbeddings(limit = 25) {
  const results: EmbeddingSyncResult[] = []
  for (const sourceType of semanticSourceTypes) {
    if (results.length >= limit) break
    const sources = await client().from(sourceType).select('*').eq('status', 'published').limit(limit - results.length)
    if (sources.error) throw new DatabaseOperationError(sources.error.message, sources.error.code)
    for (const source of sources.data) {
      const existing = await client().from('knowledge_embeddings').select('status').eq('source_type', sourceType).eq('source_id', source.id).maybeSingle()
      if (existing.error) throw new DatabaseOperationError(existing.error.message, existing.error.code)
      if (!existing.data || existing.data.status === 'failed' || existing.data.status === 'pending') results.push(await syncEmbedding(sourceType, source as SemanticRecord))
    }
  }
  return results
}
