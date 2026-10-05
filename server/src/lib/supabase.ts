import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

const hasAllCredentials = Boolean(
  env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY,
)

export const supabaseStatus = {
  configured: hasAllCredentials,
  missingVariables: [
    !env.SUPABASE_URL && 'SUPABASE_URL',
    !env.SUPABASE_ANON_KEY && 'SUPABASE_ANON_KEY',
    !env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter((value): value is string => Boolean(value)),
}

export const supabaseAuthClient = hasAllCredentials
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

export const supabaseAdminClient = hasAllCredentials
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null
