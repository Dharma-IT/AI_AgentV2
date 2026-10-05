import { randomUUID } from 'node:crypto'
import { supabaseAdminClient } from '../lib/supabase.js'
import { createEmbedding } from './knowledge.embeddings.js'
import { knowledgeConfig } from './knowledge.config.js'
import type { KnowledgeContext, KnowledgeItem, KnowledgeLanguage, RetrievalInput } from './knowledge.types.js'

type Row = Record<string, unknown> & { id: string }

function languageFor(input: RetrievalInput): KnowledgeLanguage {
  const value = input.analysis.detectedLanguage === 'other' ? input.state.preferredLanguage : input.analysis.detectedLanguage
  return value === 'es' || value === 'pt' ? value : 'en'
}

function item(row: Row, sourceType: string, category: string, content: string): KnowledgeItem {
  return { id: row.id, sourceType, category, content, method: 'structured', attributes: sourceType === 'shipping_rules' ? { stateCode: row.state_code, isServiceable: row.is_serviceable } : undefined }
}

function values(row: Row, names: string[]) {
  return names.map((name) => row[name]).filter((value) => value !== null && value !== undefined && value !== '').map(String).join(' | ')
}

function words(value: string) { return new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) }
function rankRows(rows: Row[], message: string) {
  const query = words(message)
  return [...rows].sort((a, b) => {
    const score = (row: Row) => [...words(Object.values(row).filter((v) => typeof v === 'string').join(' '))].filter((word) => query.has(word)).length
    return score(b) - score(a)
  }).slice(0, knowledgeConfig.structuredLimitPerCategory)
}

// Supabase's ungenerated schema client exposes a table-dependent fluent builder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function published(table: string, configure?: (query: any) => any): Promise<Row[]> {
  if (!supabaseAdminClient) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabaseAdminClient.from(table).select('*').eq('status', 'published')
  if (configure) query = configure(query)
  const result = await query.limit(knowledgeConfig.structuredLimitPerCategory)
  if (result.error) throw new Error(`${table}: ${result.error.message}`)
  return result.data as Row[]
}

async function structured(input: RetrievalInput, language: KnowledgeLanguage) {
  const topics = new Set(input.analysis.questionTopics)
  const records: KnowledgeItem[] = []
  const errors: string[] = []
  const run = async (name: string, work: () => Promise<KnowledgeItem[]>) => {
    try { records.push(...await work()) } catch (cause) { errors.push(`${name}: ${cause instanceof Error ? cause.message : 'retrieval failed'}`) }
  }
  const now = new Date().toISOString()
  const asksAboutSupplements = /\b(?:supplements?|suplementos?)\b/i.test(input.message)
  const salesConsultationContext = Boolean(input.state.customerWeightGoal && input.state.customerState)

  if (topics.has('treatments') || topics.has('pricing')) await run('products', async () => (await published('products', (q) => q.eq('is_active', true))).map((r) => item(r, 'products', 'treatments', values(r, ['name', 'summary', 'description', 'detailed_information']))))
  if (asksAboutSupplements) await run('supplements', async () => (await published('products', (q) => q.eq('is_active', true).or('treatment_category.ilike.%supplement%,name.ilike.%supplement%'))).map((r) => item(r, 'products', 'supplements', values(r, ['name', 'summary', 'description', 'detailed_information']))))
  if (topics.has('pricing') || salesConsultationContext) await run('pricing', async () => (await published('pricing_packages', (q) => q.select('*,products(id,name,status,is_active)').eq('is_active', true).or(`effective_at.is.null,effective_at.lte.${now}`).or(`expires_at.is.null,expires_at.gte.${now}`))).filter((r) => !r.product_id || ((r.products as { status?: string; is_active?: boolean } | null)?.status === 'published' && (r.products as { is_active?: boolean } | null)?.is_active === true)).map((r) => {
    const product = r.products as { name?: string } | null
    return item(r, 'pricing_packages', 'pricing', `${values(r, ['name', 'description', 'price_cents', 'currency', 'billing_period'])}${product?.name ? ` | Product: ${product.name}` : ''}`)
  }))
  if (salesConsultationContext || topics.has('pricing') || /promoci|promotion|discount|deal|oferta/i.test(input.message)) await run('promotions', async () => (await published('promotions', (q) => q.eq('is_active', true).or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`))).map((r) => item(r, 'promotions', 'promotions', values(r, ['name', 'description', 'discount_type', 'discount_value', 'eligibility_conditions', 'starts_at', 'ends_at']))))
  if (topics.has('payment_methods') || salesConsultationContext) await run('payment', async () => (await published('payment_methods', (q) => q.eq('is_available', true))).map((r) => item(r, 'payment_methods', 'payment_methods', values(r, ['name', 'description', 'restrictions']))))
  if (topics.has('delivery') || input.analysis.customerStateCode || input.state.customerState) await run('shipping', async () => {
    const state = input.analysis.customerStateCode ?? input.state.customerState
    return (await published('shipping_rules', (q) => state ? q.eq('is_active', true).eq('state_code', state) : q.eq('is_active', true))).map((r) => item(r, 'shipping_rules', 'shipping', values(r, ['state_code', 'state_name', 'is_serviceable', 'description', 'estimated_delivery_timeframe', 'restrictions'])))
  })
  if (topics.has('consultation') || topics.has('other') || salesConsultationContext) await run('clinic', async () => (await published('clinic_information')).map((r) => item(r, 'clinic_information', 'clinic', values(r, ['clinic_name', 'description', 'location', 'contact_information', 'operating_hours', 'consultation_information', 'general_service_information', 'website_url', 'additional_information']))))
  if (topics.size > 0) await run('faqs', async () => rankRows(await published('faqs', (q) => q.eq('language_code', language)), input.message).map((r) => item(r, 'faqs', 'faqs', values(r, ['question', 'answer']))))
  if (topics.has('other') || topics.has('medical_suitability') || /refund|cancel|privacy|policy|política/i.test(input.message)) await run('policies', async () => rankRows(await published('business_policies', (q) => q.eq('language_code', language).or(`effective_at.is.null,effective_at.lte.${now}`).or(`expires_at.is.null,expires_at.gte.${now}`)), input.message).map((r) => item(r, 'business_policies', 'policies', values(r, ['name', 'category', 'description', 'content', 'applicable_conditions', 'effective_at', 'expires_at']))))
  const compliance: KnowledgeItem[] = []
  await run('compliance', async () => {
    const found = await published('compliance_rules', (q) => q.eq('is_active', true).order('severity', { ascending: false }))
    const mapped = found.map((r) => item(r, 'compliance_rules', 'compliance', values(r, ['name', 'severity', 'rule_text'])))
    compliance.push(...mapped)
    return []
  })
  return { records, compliance, errors }
}

async function semantic(message: string, language: KnowledgeLanguage): Promise<KnowledgeItem[]> {
  if (!supabaseAdminClient || !message.trim()) return []
  const embedding = await createEmbedding(message)
  const result = await supabaseAdminClient.rpc('match_knowledge_embeddings', { query_embedding: JSON.stringify(embedding), match_threshold: knowledgeConfig.similarityThreshold, match_count: knowledgeConfig.semanticLimit, filter_language: language })
  if (result.error) throw new Error(result.error.message)
  type MatchRow = { source_id: string; source_type: string; source_content: string; similarity: number }
  return ((result.data ?? []) as MatchRow[]).map((row) => ({ id: row.source_id, sourceType: row.source_type, category: 'conversation_guidance', content: row.source_content, method: 'semantic' as const, similarity: row.similarity }))
}

export async function retrieveKnowledge(input: RetrievalInput): Promise<KnowledgeContext> {
  const started = Date.now()
  const requestId = randomUUID()
  const language = languageFor(input)
  const exact = await structured(input, language)
  let guidance: KnowledgeItem[] = []
  try { guidance = await semantic(input.message, language) } catch (cause) { exact.errors.push(`semantic: ${cause instanceof Error ? cause.message : 'retrieval failed'}`) }
  const unique = (items: KnowledgeItem[]) => [...new Map(items.map((entry) => [`${entry.sourceType}:${entry.id}`, entry])).values()]
  let structuredItems = unique(exact.records)
  guidance = unique(guidance)
  const trim = (items: KnowledgeItem[]) => items.map((entry) => ({ ...entry, content: entry.content.slice(0, 3000) }))
  structuredItems = trim(structuredItems)
  guidance = trim(guidance)
  const compliance = trim(unique(exact.compliance))
  const all = [...compliance, ...structuredItems, ...guidance]
  let used = 0
  for (const entry of all) { const room = Math.max(0, knowledgeConfig.maximumContextCharacters - used); entry.content = entry.content.slice(0, room); used += entry.content.length }
  const context: KnowledgeContext = { requestId, language, structured: structuredItems.filter((x) => x.content), guidance: guidance.filter((x) => x.content), compliance: compliance.filter((x) => x.content), metadata: { durationMs: Date.now() - started, categories: [...new Set(all.map((x) => x.category))], recordIds: all.map((x) => x.id), noRelevantKnowledge: all.length === 0, errors: exact.errors } }
  if (knowledgeConfig.debug) console.info('Knowledge retrieval', { requestId, language, durationMs: context.metadata.durationMs, categories: context.metadata.categories, recordIds: context.metadata.recordIds, errors: context.metadata.errors })
  return context
}
