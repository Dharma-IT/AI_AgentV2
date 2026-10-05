import type { z } from 'zod'
import { supabaseAdminClient } from '../lib/supabase.js'
import { DatabaseOperationError } from './commercial.service.js'
import type { businessListQuerySchema } from './business.schemas.js'
import { removeEmbedding, syncEmbedding } from '../knowledge/knowledge.embeddings.js'
import { semanticSourceTypes, type SemanticSourceType } from '../knowledge/knowledge.types.js'

export type BusinessTable = 'shipping_rules' | 'clinic_information' | 'faqs' | 'business_policies' | 'conversation_knowledge' | 'objection_handling' | 'conversation_scenarios'
type Query = z.infer<typeof businessListQuerySchema>
type Input = Record<string, unknown>

const searchColumns: Record<BusinessTable, string[]> = {
  shipping_rules: ['state_name', 'state_code', 'description', 'restrictions'],
  clinic_information: ['clinic_name', 'description', 'location'],
  faqs: ['question', 'answer', 'category'],
  business_policies: ['name', 'description', 'content', 'category'],
  conversation_knowledge: ['title', 'description', 'content', 'category'],
  objection_handling: ['title', 'objection', 'guidance', 'category'],
  conversation_scenarios: ['name', 'description', 'customer_message', 'expected_behavior', 'category'],
}

function client() {
  if (!supabaseAdminClient) throw new DatabaseOperationError('Database is not configured')
  return supabaseAdminClient
}

function semanticTable(table: BusinessTable): table is SemanticSourceType {
  return semanticSourceTypes.includes(table as SemanticSourceType)
}

export const businessService = {
  async list(table: BusinessTable, query: Query) {
    const from = (query.page - 1) * query.pageSize
    let request = client().from(table).select('*', { count: 'exact' }).order('updated_at', { ascending: false }).range(from, from + query.pageSize - 1)
    if (query.search) request = request.or(searchColumns[table].map((column) => `${column}.ilike.%${query.search}%`).join(','))
    if (query.status) request = request.eq('status', query.status)
    if (query.category && !['shipping_rules', 'clinic_information'].includes(table)) request = request.eq('category', query.category)
    if (query.language && !['shipping_rules', 'clinic_information'].includes(table)) request = request.eq('language_code', query.language)
    if (query.active !== undefined && table === 'shipping_rules') request = request.eq('is_active', query.active)
    const result = await request
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    const now = Date.now()
    const data = table === 'business_policies' ? result.data.map((record) => ({ ...record, is_expired: Boolean(record.expires_at && new Date(record.expires_at).getTime() < now) })) : result.data
    return { data, total: result.count ?? 0, page: query.page, pageSize: query.pageSize }
  },
  async get(table: BusinessTable, id: string) {
    const result = await client().from(table).select('*').eq('id', id).maybeSingle()
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    return result.data
  },
  async create(table: BusinessTable, input: Input, userId: string) {
    const result = await client().from(table).insert({ ...input, created_by: userId, updated_by: userId }).select('*').single()
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    const embeddingSync = semanticTable(table) ? await syncEmbedding(table, result.data) : undefined
    return embeddingSync ? { ...result.data, embedding_sync: embeddingSync } : result.data
  },
  async update(table: BusinessTable, id: string, input: Input, userId: string) {
    const result = await client().from(table).update({ ...input, updated_by: userId }).eq('id', id).select('*').maybeSingle()
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    if (!result.data) return null
    const embeddingSync = semanticTable(table) ? await syncEmbedding(table, result.data) : undefined
    return embeddingSync ? { ...result.data, embedding_sync: embeddingSync } : result.data
  },
  async archive(table: BusinessTable, id: string, userId: string) {
    return this.update(table, id, { status: 'archived', ...(table === 'shipping_rules' ? { is_active: false } : {}) }, userId)
  },
  async remove(table: BusinessTable, id: string) {
    if (semanticTable(table)) await removeEmbedding(table, id)
    const result = await client().from(table).delete().eq('id', id).select('id').maybeSingle()
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    return result.data
  },
  async listPublishedCurrent(table: BusinessTable) {
    let request = client().from(table).select('*').eq('status', 'published')
    if (table === 'shipping_rules') request = request.eq('is_active', true)
    if (table === 'business_policies') {
      const now = new Date().toISOString()
      request = request.or(`effective_at.is.null,effective_at.lte.${now}`).or(`expires_at.is.null,expires_at.gte.${now}`)
    }
    const result = await request
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    return result.data
  },
}
