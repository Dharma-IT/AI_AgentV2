import type { z } from 'zod'
import { supabaseAdminClient } from '../lib/supabase.js'
import type { listQuerySchema } from './commercial.schemas.js'

export class DatabaseOperationError extends Error {
  constructor(message: string, public readonly code?: string) { super(message) }
}

type ListQuery = z.infer<typeof listQuerySchema>
type Table = 'products' | 'pricing_packages' | 'promotions' | 'payment_methods'
type RecordInput = Record<string, unknown>

function client() {
  if (!supabaseAdminClient) throw new DatabaseOperationError('Database is not configured')
  return supabaseAdminClient
}

async function ensureRelation(table: 'products' | 'pricing_packages', id: unknown) {
  if (!id) return
  const result = await client().from(table).select('id').eq('id', String(id)).maybeSingle()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  if (!result.data) throw new DatabaseOperationError(`Related ${table} record does not exist`, 'RELATION_NOT_FOUND')
}

async function validateRelationships(table: Table, input: RecordInput) {
  if (table === 'pricing_packages') await ensureRelation('products', input.product_id)
  if (table === 'promotions') {
    await ensureRelation('products', input.product_id)
    await ensureRelation('pricing_packages', input.pricing_package_id)
  }
}

export const commercialService = {
  async list(table: Table, query: ListQuery) {
    const from = (query.page - 1) * query.pageSize
    const to = from + query.pageSize - 1
    let request = client().from(table).select('*', { count: 'exact' }).order('updated_at', { ascending: false }).range(from, to)
    if (query.search) request = request.ilike('name', `%${query.search}%`)
    if (query.status) request = request.eq('status', query.status)
    if (query.active !== undefined) request = request.eq(table === 'payment_methods' ? 'is_available' : 'is_active', query.active)
    const result = await request
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    const now = Date.now()
    const data = table === 'promotions'
      ? result.data.map((record) => ({
          ...record,
          is_expired: Boolean(record.ends_at && new Date(record.ends_at).getTime() < now),
          is_currently_active: record.status === 'published' && record.is_active &&
            (!record.starts_at || new Date(record.starts_at).getTime() <= now) &&
            (!record.ends_at || new Date(record.ends_at).getTime() >= now),
        }))
      : result.data
    return { data, total: result.count ?? 0, page: query.page, pageSize: query.pageSize }
  },
  async get(table: Table, id: string) {
    const result = await client().from(table).select('*').eq('id', id).maybeSingle()
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    return result.data
  },
  async create(table: Table, input: RecordInput, userId: string) {
    await validateRelationships(table, input)
    const result = await client().from(table).insert({ ...input, created_by: userId, updated_by: userId }).select('*').single()
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    return result.data
  },
  async update(table: Table, id: string, input: RecordInput, userId: string) {
    await validateRelationships(table, input)
    const result = await client().from(table).update({ ...input, updated_by: userId }).eq('id', id).select('*').maybeSingle()
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    return result.data
  },
  async archive(table: Table, id: string, userId: string) {
    return this.update(table, id, { status: 'archived', ...(table === 'payment_methods' ? { is_available: false } : { is_active: false }) }, userId)
  },
  async remove(table: Table, id: string) {
    const result = await client().from(table).delete().eq('id', id).select('id').maybeSingle()
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    return result.data
  },
  async listPublishedCurrent(table: Table) {
    let request = client().from(table).select('*').eq('status', 'published')
    request = request.eq(table === 'payment_methods' ? 'is_available' : 'is_active', true)
    if (table === 'promotions') {
      const now = new Date().toISOString()
      request = request.or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`)
    }
    const result = await request
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
    return result.data
  },
}

export type CommercialTable = Table
