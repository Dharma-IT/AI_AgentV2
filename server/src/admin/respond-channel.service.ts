import { supabaseAdminClient } from '../lib/supabase.js'
import { RespondClient } from '../integrations/respond/respond.client.js'
import { DatabaseOperationError } from './commercial.service.js'

export type RespondChannelPolicy = {
  id: string
  respond_channel_id: number
  channel_name: string
  source: string
  enabled: boolean
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

export async function setRespondChannelEnabled(channelId: number, enabled: boolean, userId: string) {
  const result = await database().from('respond_channel_policies')
    .update({ enabled, updated_by: userId })
    .eq('respond_channel_id', channelId).select('*').maybeSingle()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as RespondChannelPolicy | null
}

export async function setRespondProviderEnabled(source: string, enabled: boolean, userId: string) {
  const sources = source === 'meta'
    ? ['facebook', 'instagram']
    : source === 'email'
      ? ['gmail', 'email']
      : source === 'whatsapp'
        ? ['whatsapp_business', 'whatsapp']
        : [source]
  const result = await database().from('respond_channel_policies')
    .update({ enabled, updated_by: userId })
    .in('source', sources).select('*')
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data as RespondChannelPolicy[]
}

export async function isRespondChannelEnabled(channelId: number) {
  const result = await database().from('respond_channel_policies').select('enabled')
    .eq('respond_channel_id', channelId).maybeSingle()
  if (result.error) throw new DatabaseOperationError(result.error.message, result.error.code)
  return result.data?.enabled === true
}
