import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Radio, ShieldCheck, RotateCcw } from 'lucide-react'
import { adminFetch, useAdminSession } from '../AdminSession'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'

type Channel = {
  respond_channel_id: number
  channel_name: string
  source: string
  maria_enabled: boolean
  claudia_enabled: boolean
  last_seen_at: string
}
type ContactControl = { respond_contact_id:string; contact_name:string|null; mode:'maria'|'booked_agent'|'front_desk'; owner_name:string|null; locked_until:string|null; last_action:string|null; respond_status?:string; currently_assigned?:boolean }

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
  const [contacts, setContacts] = useState<ContactControl[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [contactSearchStatus, setContactSearchStatus] = useState<'idle'|'loading'|'done'>('idle')
  const [contactError, setContactError] = useState('')
  const [contactSuccess, setContactSuccess] = useState('')
  const [salesUrl, setSalesUrl] = useState('')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState('')

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

  useEffect(() => {
    if (!session) return
    void adminFetch(session.access_token, '/bot-settings/claudia').then(async (response) => {
      const body = await response.json() as { data?: { sales_url: string | null }; error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Unable to load Claudia settings')
      setSalesUrl(body.data?.sales_url ?? ''); setSettingsLoaded(true)
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load Claudia settings'))
  }, [session])

  const groups = useMemo(() => {
    const grouped = (channels ?? []).reduce<Record<string, Channel[]>>((result, channel) => {
      ;(result[providerGroup(channel.source)] ??= []).push(channel)
      return result
    }, {})
    return Object.entries(grouped)
  }, [channels])

  async function update(path: string, personality: 'maria'|'claudia', enabled: boolean, key: string) {
    if (!session) return
    setSaving(key); setError('')
    try {
      const response = await adminFetch(session.access_token, path, { method: 'PUT', body: JSON.stringify({ personality, enabled }) })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Unable to update channel setting')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update channel setting')
    } finally { setSaving('') }
  }

  async function saveClaudiaSettings(event: React.FormEvent) {
    event.preventDefault(); if (!session) return
    setSaving('claudia-settings'); setError(''); setSettingsSuccess('')
    try {
      const response = await adminFetch(session.access_token, '/bot-settings/claudia', { method:'PUT', body:JSON.stringify({ sales_url:salesUrl.trim() || null }) })
      const body = await response.json() as { error?:string; details?:string[] }
      if (!response.ok) throw new Error(body.details?.join(', ') ?? body.error ?? 'Unable to save Claudia settings')
      setSettingsSuccess('Claudia sales link saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save Claudia settings') }
    finally { setSaving('') }
  }

  async function loadContacts(search = contactSearch) {
    if (!session) return
    setContactSearchStatus('loading'); setContactError('')
    try {
      const response = await adminFetch(session.access_token, `/respond-contacts?search=${encodeURIComponent(search)}`)
      const body = await response.json() as { data?:ContactControl[]; error?:string }
      if (!response.ok) throw new Error(body.error ?? 'Unable to load contact controls')
      setContacts(body.data ?? []); setContactSearchStatus('done')
    } catch (cause) {
      setContactError(cause instanceof Error ? cause.message : 'Unable to search Respond.io contacts')
      setContactSearchStatus('done')
    }
  }

  async function resetContact(contact: ContactControl) {
    if (!session || !window.confirm(`Allow the channel's configured bot to respond to ${contact.contact_name ?? contact.respond_contact_id}? This will also unassign the conversation.`)) return
    setSaving(`contact:${contact.respond_contact_id}`); setError(''); setContactError(''); setContactSuccess('')
    try {
      const response = await adminFetch(session.access_token, `/respond-contacts/${encodeURIComponent(contact.respond_contact_id)}/reset`, { method:'POST' })
      const body = await response.json() as { error?:string; data?:{reset_at?:string} }
      if (!response.ok) throw new Error(body.error ?? 'Unable to reset contact')
      if (!body.data?.reset_at) throw new Error('Reset response did not include a confirmation timestamp')
      setContactSuccess(`Chat memory reset successfully at ${new Date(body.data.reset_at).toLocaleString()}. The channel's configured bot will restart with its approved greeting on the next incoming message.`)
      await loadContacts()
    } catch (cause) { setContactError(cause instanceof Error ? cause.message : 'Unable to reset contact') }
    finally { setSaving('') }
  }

  if (error && !channels) return <ErrorState message={error} />
  if (!channels) return <LoadingState />

  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <PageHeader title="Respond.io channels" description="Assign each channel to Maria booking, Claudia sales, or leave it off." />
      <button type="button" onClick={() => void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to refresh channels'))} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-medium"><RefreshCw size={16} />Refresh channels</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldCheck className="mr-2 inline" size={17} />Maria and Claudia cannot both be enabled on the same channel. Disable one personality before enabling the other.</div>
    <div className="space-y-5">
      {groups.map(([source, entries]) => {
        const providerChannels = entries ?? []
        const allMaria = providerChannels.length > 0 && providerChannels.every((channel) => channel.maria_enabled)
        const allClaudia = providerChannels.length > 0 && providerChannels.every((channel) => channel.claudia_enabled)
        const providerKey = `provider:${source}`
        return <section key={source} className="overflow-hidden rounded-2xl border bg-white">
          <header className="flex items-center justify-between gap-4 border-b bg-slate-50 px-5 py-4">
            <div><h2 className="flex items-center gap-2 font-semibold"><Radio size={17} />{labelFor(source)}</h2><p className="mt-1 text-xs text-slate-500">{providerChannels.length} connected channels</p></div>
            <div className="flex gap-4 text-xs"><label className="flex items-center gap-2">Maria <Toggle checked={allMaria} disabled={saving !== ''} label={`Toggle Maria for all ${labelFor(source)} channels`} onChange={(enabled) => void update(`/respond-channel-providers/${source}`, 'maria', enabled, `${providerKey}:maria`)} /></label><label className="flex items-center gap-2">Claudia <Toggle checked={allClaudia} disabled={saving !== ''} label={`Toggle Claudia for all ${labelFor(source)} channels`} onChange={(enabled) => void update(`/respond-channel-providers/${source}`, 'claudia', enabled, `${providerKey}:claudia`)} /></label></div>
          </header>
          <div className="divide-y">
            {providerChannels.map((channel) => <div key={channel.respond_channel_id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0"><p className="truncate font-medium">{channel.channel_name}</p><p className="mt-1 text-xs text-slate-500">Channel ID {channel.respond_channel_id} · {channel.maria_enabled ? 'Maria' : channel.claudia_enabled ? 'Claudia' : 'Off'}</p></div>
              <div className="flex items-center gap-4 text-xs"><label className="flex items-center gap-2">Maria <Toggle checked={channel.maria_enabled} disabled={saving !== ''} label={`Toggle Maria on ${channel.channel_name}`} onChange={(enabled) => void update(`/respond-channels/${channel.respond_channel_id}`, 'maria', enabled, `${channel.respond_channel_id}:maria`)} /></label><label className="flex items-center gap-2">Claudia <Toggle checked={channel.claudia_enabled} disabled={saving !== ''} label={`Toggle Claudia on ${channel.channel_name}`} onChange={(enabled) => void update(`/respond-channels/${channel.respond_channel_id}`, 'claudia', enabled, `${channel.respond_channel_id}:claudia`)} /></label></div>
            </div>)}
          </div>
        </section>
      })}
    </div>
    <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Claudia sales settings</h2><p className="mt-1 text-sm text-slate-500">This HTTPS link is included once after Claudia receives a weight goal and again when a customer asks for it.</p>{settingsSuccess?<p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{settingsSuccess}</p>:null}<form onSubmit={(event)=>void saveClaudiaSettings(event)} className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="url" pattern="https://.*" required value={salesUrl} disabled={!settingsLoaded} onChange={(event)=>setSalesUrl(event.target.value)} placeholder="https://…" className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button disabled={saving!==''||!settingsLoaded} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save sales link</button></form></section>
    <section className="overflow-hidden rounded-2xl border bg-white">
      <header className="border-b bg-slate-50 px-5 py-4"><h2 className="font-semibold">Contact automation controls</h2><p className="mt-1 text-sm text-slate-500">Review booking locks and Front Desk handoffs. Reset clears the bot lock and unassigns the contact.</p></header>
      <form className="flex gap-2 border-b p-4" onSubmit={(event)=>{event.preventDefault();void loadContacts()}}><input value={contactSearch} onChange={(event)=>setContactSearch(event.target.value)} placeholder="Search contact ID, name, email, or phone" className="min-w-0 flex-1 rounded-xl border px-3 py-2"/><button type="submit" disabled={contactSearchStatus==='loading'||!contactSearch.trim()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{contactSearchStatus==='loading'?'Searching…':'Search'}</button></form>
      {contactError?<p className="border-b bg-red-50 p-4 text-sm text-red-700">{contactError}</p>:null}
      {contactSuccess?<p className="border-b bg-emerald-50 p-4 text-sm text-emerald-800">{contactSuccess}</p>:null}
      {contacts.length===0?<p className="p-5 text-sm text-slate-500">{contactSearchStatus==='done'?'No Respond.io contacts matched that search.':'Search by Respond.io contact name, email, phone number, or contact ID.'}</p>:<div className="divide-y">{contacts.map((contact)=><div key={contact.respond_contact_id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div><p className="font-medium">{contact.contact_name??`Contact ${contact.respond_contact_id}`}</p><p className="mt-1 text-xs text-slate-500">ID {contact.respond_contact_id} · {contact.mode.replace('_',' ')}{contact.respond_status?` · ${contact.respond_status}`:''}{contact.owner_name?` · assigned to ${contact.owner_name}`:''}{contact.locked_until?` · locked until ${new Date(contact.locked_until).toLocaleString()}`:''}</p></div><button type="button" disabled={saving!==''} onClick={()=>void resetContact(contact)} className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50"><RotateCcw size={15}/>Reset chat memory</button></div>)}</div>}
    </section>
  </div>
}
