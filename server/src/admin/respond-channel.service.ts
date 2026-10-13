import { supabaseAdminClient } from '../lib/supabase.js'
import { RespondClient } from '../integrations/respond/respond.client.js'
import { DatabaseOperationError } from './commercial.service.js'

export type RespondChannelPolicy = {
  id: string
  respond_channel_id: number
  channel_name: string
  source: string
  maria_enabled: boolean
  claudia_enabled: boolean
  last_seen_at: string
  updated_at: string
}

function database() {
  if (!supabaseAdminClient) throw new DatabaseOperationError('Database is not configured')
  return supabaseAdminClient
}

export async function synchronizeRespondChannels(client: Pick<RespondClient, 'listChannels'> = new RespondClient()) {
  const channels = await client.listChannels()
  const now = new Date().toISOString()
  if (channels.length) {
    const result = await database().from('respond_channel_policies').upsert(
      channels.map((channel) => ({
        respond_channel_id: channel.id,
        channel_name: channel.name,
        source: channel.source,
        last_seen_at: now,
      })),
      { onConflict: 'respond_channel_id', ignoreDuplicates: false },
    )
    if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  }
  return listRespondChannelPolicies()
}

export async function listRespondChannelPolicies() {
  const result = await database().from('respond_channel_policies').select('*')
    .order('source').order('channel_name')
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as RespondChannelPolicy[]
}

export class RespondChannelConflictError extends Error {}

export async function setRespondChannelEnabled(channelId: number, personality: 'maria' | 'claudia', enabled: boolean, userId: string) {
  if (enabled) {
    const current = await database().from('respond_channel_policies').select('maria_enabled,claudia_enabled').eq('respond_channel_id', channelId).maybeSingle()
    if (current.error) throw new DatabaseOperationError(current.error.message, current.error.code)
    const otherEnabled = personality === 'maria' ? current.data?.claudia_enabled : current.data?.maria_enabled
    if (otherEnabled) throw new RespondChannelConflictError(`Disable ${personality === 'maria' ? 'Claudia' : 'Maria'} on this channel first`)
  }
  const result = await database().from('respond_channel_policies')
    .update({ [`${personality}_enabled`]: enabled, updated_by: userId })
    .eq('respond_channel_id', channelId).select('*').maybeSingle()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as RespondChannelPolicy | null
}

export async function setRespondProviderEnabled(source: string, personality: 'maria' | 'claudia', enabled: boolean, userId: string) {
  const sources = source === 'meta'
    ? ['facebook', 'instagram']
    : source === 'email'
      ? ['gmail', 'email']
      : source === 'whatsapp'
        ? ['whatsapp_business', 'whatsapp']
        : [source]
  if (enabled) {
    const existing = await database().from('respond_channel_policies').select('maria_enabled,claudia_enabled').in('source', sources)
    if (existing.error) throw new DatabaseOperationError(existing.error.message, existing.error.code)
    const conflict = existing.data?.some((row) => personality === 'maria' ? row.claudia_enabled : row.maria_enabled)
    if (conflict) throw new RespondChannelConflictError(`Disable ${personality === 'maria' ? 'Claudia' : 'Maria'} on every channel in this provider first`)
  }
  const result = await database().from('respond_channel_policies')
    .update({ [`${personality}_enabled`]: enabled, updated_by: userId })
    .in('source', sources).select('*')
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as RespondChannelPolicy[]
}

export async function getRespondChannelPersonality(channelId: number) {
  const result = await database().from('respond_channel_policies').select('maria_enabled,claudia_enabled')
    .eq('respond_channel_id', channelId).maybeSingle()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  if (result.data?.claudia_enabled) return 'claudia' as const
  if (result.data?.maria_enabled) return 'maria' as const
  return null
}
