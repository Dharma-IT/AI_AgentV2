import { supabaseAdminClient, supabaseStatus } from '../lib/supabase.js'

const requiredTables = [
  'admin_users',
  'products',
  'pricing_packages',
  'promotions',
  'payment_methods',
  'shipping_rules',
  'faqs',
  'conversation_knowledge',
  'objection_handling',
  'conversation_scenarios',
  'compliance_rules',
  'knowledge_documents',
  'knowledge_audit_logs',
  'clinic_information',
  'business_policies',
  'knowledge_embeddings',
  'respond_channel_policies',
  'respond_contact_automation',
  'respond_front_desk_rotation',
] as const

export type SupabaseHealth = {
  configured: boolean
  connection: 'not_configured' | 'connected' | 'schema_incomplete' | 'unavailable'
  requiredTables: number
  accessibleTables: number
  missingTables: string[]
}

let cached: { expiresAt: number; value: SupabaseHealth } | null = null

export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  if (!supabaseStatus.configured || !supabaseAdminClient) {
    return {
      configured: false,
      connection: 'not_configured',
      requiredTables: requiredTables.length,
      accessibleTables: 0,
      missingTables: [...requiredTables],
    }
  }

  if (cached && cached.expiresAt > Date.now()) return cached.value
  const client = supabaseAdminClient

  const checks = await Promise.all(
    requiredTables.map(async (table) => {
      const { error } = await client.from(table).select('*').limit(1)
      return { table, error }
    }),
  )
  const missingTables = checks
    .filter(({ error }) => error?.code === 'PGRST205' || error?.code === '42P01')
    .map(({ table }) => table)
  const hasConnectionFailure = checks.some(
    ({ error }) => error && error.code !== 'PGRST205' && error.code !== '42P01',
  )
  const value: SupabaseHealth = {
    configured: true,
    connection: hasConnectionFailure
      ? 'unavailable'
      : missingTables.length > 0
        ? 'schema_incomplete'
        : 'connected',
    requiredTables: requiredTables.length,
    accessibleTables: requiredTables.length - missingTables.length,
    missingTables,
  }

  cached = { value, expiresAt: Date.now() + 30_000 }
  return value
}
