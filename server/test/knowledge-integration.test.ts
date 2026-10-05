import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { supabaseAdminClient } from '../src/lib/supabase.js'
import { retrieveKnowledge } from '../src/knowledge/knowledge.retrieval.js'
import { retryFailedEmbeddings, syncEmbedding } from '../src/knowledge/knowledge.embeddings.js'
import type { ConversationState, MessageAnalysis } from '../src/domain/conversation.js'

const marker = `m35-${randomUUID()}`
const ids: Record<string, string[]> = {}
function remember(table: string, id: string) { (ids[table] ??= []).push(id); return id }

function state(): ConversationState {
  const now = new Date().toISOString()
  return { id: marker, currentStage: 'state', customerWeightGoal: 'lose weight', customerState: 'ZX', stateEligibility: 'unknown', preferredLanguage: 'en', introductionSent: true, empathyResponseSent: true, consultationIntroSent: false, promotionIntroSent: false, startingPriceSent: false, paymentOptionsSent: false, appointmentOfferSent: false, appointmentStageActive: false, alternativeFlowActive: false, supplementAlternativeSent: false, selectedAppointmentPreference: null, conversationStatus: 'active', lastAskedQuestion: 'state', messages: [], createdAt: now, updatedAt: now }
}

const analysis: MessageAnalysis = { detectedLanguage: 'en', customerWeightGoal: null, customerStateCode: null, questionTopics: ['pricing', 'treatments', 'payment_methods', 'delivery', 'consultation', 'medical_suitability', 'other'], appointmentIntent: 'none', appointmentPreference: null }

async function insert(table: string, record: Record<string, unknown>) {
  if (!supabaseAdminClient) throw new Error('Supabase is not configured')
  const result = await supabaseAdminClient.from(table).insert(record).select('*').single()
  if (result.error) throw result.error
  remember(table, result.data.id)
  return result.data
}

async function cleanup() {
  if (!supabaseAdminClient) return
  await supabaseAdminClient.from('knowledge_embeddings').delete().in('source_id', Object.values(ids).flat())
  for (const table of ['promotions', 'pricing_packages', 'products', 'payment_methods', 'shipping_rules', 'clinic_information', 'faqs', 'business_policies', 'compliance_rules', 'conversation_knowledge'] as const) {
    if (ids[table]?.length) await supabaseAdminClient.from(table).delete().in('id', ids[table])
  }
}

test('hybrid retrieval enforces publication, activity, validity, state, and language', { timeout: 60_000 }, async () => {
  if (!supabaseAdminClient) return
  try {
    const product = await insert('products', { name: `${marker} treatment`, slug: marker, status: 'published', is_active: true })
    await insert('products', { name: `${marker} supplement`, slug: `${marker}-supplement`, treatment_category: 'supplement', description: 'Approved supplement information', status: 'published', is_active: true })
    await insert('products', { name: `${marker} draft`, slug: `${marker}-draft`, status: 'draft', is_active: true })
    await insert('pricing_packages', { product_id: product.id, name: `${marker} current price`, price_cents: 12345, currency: 'USD', billing_period: 'monthly', status: 'published', is_active: true })
    await insert('pricing_packages', { product_id: product.id, name: `${marker} expired price`, price_cents: 99999, currency: 'USD', billing_period: 'monthly', status: 'published', is_active: true, expires_at: '2020-01-01T00:00:00.000Z' })
    await insert('promotions', { name: `${marker} current promotion`, description: 'Current', status: 'published', is_active: true, starts_at: '2020-01-01T00:00:00.000Z', ends_at: '2099-01-01T00:00:00.000Z' })
    await insert('promotions', { name: `${marker} expired promotion`, description: 'Expired', status: 'published', is_active: true, ends_at: '2020-01-01T00:00:00.000Z' })
    await insert('payment_methods', { name: `${marker} card`, status: 'published', is_available: true })
    await insert('shipping_rules', { state_code: 'ZX', state_name: `${marker} test state`, is_serviceable: true, status: 'published', is_active: true })
    await insert('clinic_information', { clinic_name: `${marker} clinic`, status: 'published' })
    await insert('faqs', { question: `${marker} consultation?`, answer: 'Approved answer', category: marker, language_code: 'en', status: 'published' })
    await insert('faqs', { question: `${marker} Spanish`, answer: 'No mezclar', category: marker, language_code: 'es', status: 'published' })
    await insert('business_policies', { name: `${marker} current policy`, category: marker, content: 'Current policy', language_code: 'en', status: 'published' })
    await insert('business_policies', { name: `${marker} expired policy`, category: marker, content: 'Expired policy', language_code: 'en', status: 'published', expires_at: '2020-01-01T00:00:00.000Z' })
    await insert('compliance_rules', { name: marker, rule_text: 'Escalate individualized medical questions.', severity: 'required', status: 'published', is_active: true })
    const context = await retrieveKnowledge({ message: `${marker} What is the price, promotion, delivery, consultation, and policy?`, state: state(), analysis })
    const combined = context.structured.map((x) => x.content).join('\n')
    assert.match(combined, /12345/)
    assert.doesNotMatch(combined, /99999|expired price|expired promotion|expired policy|No mezclar|draft/)
    assert.equal(context.structured.find((x) => x.sourceType === 'shipping_rules')?.attributes?.isServiceable, true)
    assert.ok(context.compliance.some((x) => x.content.includes('Escalate individualized')))
    const supplements = await retrieveKnowledge({ message: 'What supplements are available?', state: state(), analysis: { ...analysis, questionTopics: ['other'] } })
    assert.ok(supplements.structured.some((x) => x.category === 'supplements' && x.content.includes(`${marker} supplement`)))
  } finally { await cleanup() }
})

test('embedding lifecycle creates, skips unchanged, updates, excludes, records failure, and retries', { timeout: 120_000 }, async () => {
  if (!supabaseAdminClient) return
  try {
    const source = await insert('conversation_knowledge', { title: marker, category: 'hesitation', content: 'When a customer needs time, acknowledge the concern and avoid pressure.', language_code: 'en', status: 'published' })
    assert.equal((await syncEmbedding('conversation_knowledge', source)).status, 'ready')
    assert.equal((await syncEmbedding('conversation_knowledge', source)).status, 'unchanged')
    const updated = { ...source, content: 'Acknowledge hesitation naturally, answer questions, and avoid pressure.' }
    assert.equal((await syncEmbedding('conversation_knowledge', updated)).status, 'ready')
    assert.equal((await syncEmbedding('conversation_knowledge', { ...updated, status: 'draft' })).status, 'excluded')
    const absent = await supabaseAdminClient.from('knowledge_embeddings').select('id').eq('source_id', source.id).maybeSingle()
    assert.equal(absent.data, null)

    const failing = await insert('conversation_knowledge', { title: `${marker}-failure`, category: 'test', content: 'word '.repeat(20_000), language_code: 'en', status: 'published' })
    assert.equal((await syncEmbedding('conversation_knowledge', failing)).status, 'failed')
    const repairedContent = 'Short approved retry content.'
    const repaired = await supabaseAdminClient.from('conversation_knowledge').update({ content: repairedContent }).eq('id', failing.id).select('*').single()
    if (repaired.error) throw repaired.error
    const retried = await retryFailedEmbeddings(25)
    assert.ok(retried.some((x) => x.sourceId === failing.id && x.status === 'ready'))
  } finally { await cleanup() }
})

test('shipping retrieval excludes draft and inactive rules and preserves unavailable eligibility', { timeout: 60_000 }, async () => {
  if (!supabaseAdminClient) return
  const localIds: string[] = []
  try {
    for (const record of [
      { state_code: 'ZQ', state_name: 'Draft test', status: 'draft', is_active: true, is_serviceable: true },
      { state_code: 'ZR', state_name: 'Inactive test', status: 'published', is_active: false, is_serviceable: true },
      { state_code: 'ZS', state_name: 'Unavailable test', status: 'published', is_active: true, is_serviceable: false },
    ]) {
      const result = await supabaseAdminClient.from('shipping_rules').insert(record).select('id').single()
      if (result.error) throw result.error
      localIds.push(result.data.id)
    }
    const retrieve = (code: string) => retrieveKnowledge({ message: `Do you ship to ${code}?`, state: { ...state(), customerState: code }, analysis: { ...analysis, customerStateCode: code, questionTopics: ['delivery'] } })
    assert.equal((await retrieve('ZQ')).structured.some((x) => x.sourceType === 'shipping_rules'), false)
    assert.equal((await retrieve('ZR')).structured.some((x) => x.sourceType === 'shipping_rules'), false)
    const unavailable = (await retrieve('ZS')).structured.find((x) => x.sourceType === 'shipping_rules')
    assert.equal(unavailable?.attributes?.isServiceable, false)
  } finally {
    if (localIds.length) await supabaseAdminClient.from('shipping_rules').delete().in('id', localIds)
  }
})

test('eligible consultation context retrieves approved sales facts without prompt hardcoding', { timeout: 60_000 }, async () => {
  if (!supabaseAdminClient) return
  const current = state()
  current.customerState = 'FL'
  const context = await retrieveKnowledge({ message: 'I want to lose 20 pounds and I live in Florida.', state: current, analysis: { ...analysis, customerStateCode: 'FL', questionTopics: [] } })
  const content = context.structured.map((entry) => entry.content).join('\n')
  assert.ok(context.structured.some((entry) => entry.sourceType === 'clinic_information'))
  assert.ok(context.structured.some((entry) => entry.sourceType === 'pricing_packages'))
  assert.ok(context.structured.some((entry) => entry.sourceType === 'promotions'))
  assert.equal(context.structured.filter((entry) => entry.sourceType === 'payment_methods').length, 4)
  assert.match(content, /20-minute video call analysis/)
  assert.match(content, /26600.*USD.*monthly/)
  assert.match(content, /10/)
  for (const method of ['Affirm', 'Klarna', 'Afterpay', 'CareCredit']) assert.match(content, new RegExp(method))
})
