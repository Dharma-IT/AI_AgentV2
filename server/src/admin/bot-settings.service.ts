import { z } from 'zod'
import { supabaseAdminClient } from '../lib/supabase.js'
import { DatabaseOperationError } from './commercial.service.js'

export const claudiaSettingsSchema = z.object({
  sales_url: z.string().url().refine((value) => new URL(value).protocol === 'https:', 'Sales URL must use HTTPS').nullable(),
})

export type ClaudiaSettings = { personality: 'claudia'; sales_url: string | null; updated_at: string }

function database() {
  if (!supabaseAdminClient) throw new DatabaseOperationError('Database is not configured')
  return supabaseAdminClient
}

export async function getClaudiaSettings() {
  const result = await database().from('bot_settings').select('personality,sales_url,updated_at').eq('personality', 'claudia').single()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as ClaudiaSettings
}

export async function updateClaudiaSettings(salesUrl: string | null, userId: string) {
  const result = await database().from('bot_settings').update({ sales_url: salesUrl, updated_by: userId })
    .eq('personality', 'claudia').select('personality,sales_url,updated_at').single()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as ClaudiaSettings
}

export async function getClaudiaSalesUrl() {
  try {
    return (await getClaudiaSettings()).sales_url
  } catch (error) {
    console.error('Claudia sales URL is unavailable', error instanceof Error ? error.message : error)
    return null
  }
}
