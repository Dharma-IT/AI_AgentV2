import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Radio, ShieldCheck } from 'lucide-react'
import { adminFetch, useAdminSession } from '../AdminSession'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'

type Channel = {
  respond_channel_id: number
  channel_name: string
  source: string
  enabled: boolean
  last_seen_at: string
}

const providerLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  meta: 'Meta (Facebook & Instagram)',
  tiktok_business: 'TikTok',
  email: 'Email',
  webchat: 'Website Chat',
  telegram: 'Telegram',
  line: 'LINE',
  wechat: 'WeChat',
  viber: 'Viber',
  sms: 'SMS',
  custom: 'Custom Channels',
}

function labelFor(source: string) {
  return providerLabels[source] ?? source.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase())
}

function providerGroup(source: string) {
  if (source === 'facebook' || source === 'instagram') return 'meta'
  if (source === 'whatsapp_business' || source === 'whatsapp') return 'whatsapp'
  if (source === 'gmail' || source === 'email') return 'email'
  return source
}

function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'} disabled:cursor-wait disabled:opacity-50`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button>
}

export function RespondChannelSettingsPage() {
  const { session } = useAdminSession()
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState('')

  const load = useCallback(async () => {
    if (!session) return
    const response = await adminFetch(session.access_token, '/respond-channels')
    const body = await response.json() as { data?: Channel[]; error?: string }
    if (!response.ok) throw new Error(body.error ?? 'Unable to load Respond.io channels')
    setChannels(body.data ?? [])
  }, [session])

  useEffect(() => {
    if (!session) return
    let active = true
    void adminFetch(session.access_token, '/respond-channels')
      .then(async (response) => {
        const body = await response.json() as { data?: Channel[]; error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Unable to load Respond.io channels')
        if (active) setChannels(body.data ?? [])
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load Respond.io channels') })
    return () => { active = false }
  }, [session])

  const groups = useMemo(() => {
    const grouped = (channels ?? []).reduce<Record<string, Channel[]>>((result, channel) => {
      ;(result[providerGroup(channel.source)] ??= []).push(channel)
      return result
    }, {})
    return Object.entries(grouped)
  }, [channels])

  async function update(path: string, enabled: boolean, key: string) {
    if (!session) return
    setSaving(key); setError('')
    try {
      const response = await adminFetch(session.access_token, path, { method: 'PUT', body: JSON.stringify({ enabled }) })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Unable to update channel setting')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update channel setting')
    } finally { setSaving('') }
  }

  if (error && !channels) return <ErrorState message={error} />
  if (!channels) return <LoadingState />

  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <PageHeader title="Respond.io channels" description="Control exactly where Maria may respond. Newly connected channels remain off until you enable them." />
      <button type="button" onClick={() => void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to refresh channels'))} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-medium"><RefreshCw size={16} />Refresh channels</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldCheck className="mr-2 inline" size={17} />A message is eligible only when its exact channel is enabled. Provider switches below update every connected account in that group.</div>
    <div className="space-y-5">
      {groups.map(([source, entries]) => {
        const providerChannels = entries ?? []
        const allEnabled = providerChannels.length > 0 && providerChannels.every((channel) => channel.enabled)
        const providerKey = `provider:${source}`
        return <section key={source} className="overflow-hidden rounded-2xl border bg-white">
          <header className="flex items-center justify-between gap-4 border-b bg-slate-50 px-5 py-4">
            <div><h2 className="flex items-center gap-2 font-semibold"><Radio size={17} />{labelFor(source)}</h2><p className="mt-1 text-xs text-slate-500">{providerChannels.filter((channel) => channel.enabled).length} of {providerChannels.length} enabled</p></div>
            <Toggle checked={allEnabled} disabled={saving !== ''} label={`Toggle all ${labelFor(source)} channels`} onChange={(enabled) => void update(`/respond-channel-providers/${source}`, enabled, providerKey)} />
          </header>
          <div className="divide-y">
            {providerChannels.map((channel) => <div key={channel.respond_channel_id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0"><p className="truncate font-medium">{channel.channel_name}</p><p className="mt-1 text-xs text-slate-500">Channel ID {channel.respond_channel_id}</p></div>
              <div className="flex items-center gap-3"><span className={`text-xs font-medium ${channel.enabled ? 'text-emerald-700' : 'text-slate-500'}`}>{channel.enabled ? 'Maria enabled' : 'Maria disabled'}</span><Toggle checked={channel.enabled} disabled={saving !== ''} label={`Toggle ${channel.channel_name}`} onChange={(enabled) => void update(`/respond-channels/${channel.respond_channel_id}`, enabled, String(channel.respond_channel_id))} /></div>
            </div>)}
          </div>
        </section>
      })}
    </div>
  </div>
}
