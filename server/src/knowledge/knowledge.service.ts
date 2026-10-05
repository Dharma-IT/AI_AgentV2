import { supabaseAdminClient, supabaseStatus } from '../lib/supabase.js'
import { knowledgeConfig } from './knowledge.config.js'
import { retryFailedEmbeddings } from './knowledge.embeddings.js'

export async function knowledgeHealth() {
  if (!supabaseAdminClient || !supabaseStatus.configured) return { database: 'not_configured', retrieval: 'unavailable', embeddings: 'unavailable', eligiblePublished: 0, embedded: 0, pending: 0, failed: 0, lastSynchronizedAt: null, model: knowledgeConfig.embeddingModel }
  const client = supabaseAdminClient
  const sources = ['conversation_knowledge', 'objection_handling', 'conversation_scenarios'] as const
  const [counts, embeddings] = await Promise.all([
    Promise.all(sources.map((source) => client.from(source).select('id', { count: 'exact', head: true }).eq('status', 'published'))),
    client.from('knowledge_embeddings').select('status,embedded_at'),
  ])
  const sourceError = counts.find((x) => x.error)?.error
  if (sourceError || embeddings.error) throw new Error(sourceError?.message ?? embeddings.error?.message)
  const rows = embeddings.data ?? []
  const eligiblePublished = counts.reduce((sum, x) => sum + (x.count ?? 0), 0)
  const tracked = rows.filter((x) => x.status === 'ready' || x.status === 'failed' || x.status === 'pending').length
  const latest = rows.map((x) => x.embedded_at).filter(Boolean).sort().at(-1) ?? null
  return { database: 'connected', retrieval: 'operational', embeddings: rows.some((x) => x.status === 'failed') ? 'degraded' : 'operational', eligiblePublished, embedded: rows.filter((x) => x.status === 'ready').length, pending: rows.filter((x) => x.status === 'pending').length + Math.max(0, eligiblePublished - tracked), failed: rows.filter((x) => x.status === 'failed').length, lastSynchronizedAt: latest, model: knowledgeConfig.embeddingModel }
}

export { retryFailedEmbeddings }
