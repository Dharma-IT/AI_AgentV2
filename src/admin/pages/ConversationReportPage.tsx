import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, MessageSquareReply, MessagesSquare, RefreshCw } from 'lucide-react'
import { adminFetch, useAdminSession } from '../AdminSession'
import { ErrorState, LoadingState } from '../components/States'
import type { LucideIcon } from 'lucide-react'

type Report = {
  timezone: string
  from: string
  to: string
  generatedAt: string
  stats: { conversations: number; totalReplies: number; averageReplies: number; successfulBookings: number }
  hourly: Array<{ hour: number; label: string; count: number }>
  channels: Array<{ channelId: number; channelName: string; count: number }>
  conversations: Array<{ contactId: number; contactName: string; channelId: number; firstRepliedAt: string; lastRepliedAt: string; replies: number; latestReply: string; booked: boolean }>
}

function easternDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function easternDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(Date.parse(value))
}

const colors = ['#3f89a7', '#df902f', '#77a647', '#8158e8', '#94a3b8', '#ec4899']

export function ConversationReportPage() {
  const { session } = useAdminSession()
  const [from, setFrom] = useState(easternDate(-29))
  const [to, setTo] = useState(easternDate())
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  async function load() {
    if (!session) return
    setLoading(true); setError(''); setPage(1)
    try {
      for (;;) {
        const response = await adminFetch(session.access_token, `/conversation-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        const body = await response.json() as { data?: Report; error?: string; status?: string }
        if (response.status === 202 && body.status === 'pending') { await new Promise((resolve)=>setTimeout(resolve, 3000)); continue }
        if (!response.ok || !body.data) throw new Error(body.error ?? 'Unable to load conversation report')
        setReport(body.data)
        break
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load conversation report') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [session]) // eslint-disable-line react-hooks/exhaustive-deps
  const maxHour = Math.max(1, ...(report?.hourly.map((item) => item.count) ?? [1]))
  const rows = useMemo(() => report?.conversations.slice((page - 1) * pageSize, page * pageSize) ?? [], [report, page])
  const totalPages = Math.max(1, Math.ceil((report?.conversations.length ?? 0) / pageSize))

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div><h1 className="text-3xl font-bold tracking-tight">Conversations</h1><p className="mt-1 text-sm text-slate-500">Respond.io conversations that Dharma Agent replied to. Dates use Eastern Time.</p></div>
      <div className="flex flex-wrap items-end gap-3"><label className="text-xs font-medium text-slate-600">From<input type="date" value={from} onChange={(event)=>setFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"/></label><label className="text-xs font-medium text-slate-600">To<input type="date" value={to} onChange={(event)=>setTo(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"/></label><button onClick={()=>void load()} disabled={loading || from > to} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16}/>Refresh</button></div>
    </div>
    {error && <ErrorState message={error}/>} {loading && !report ? <LoadingState/> : report && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { label:'Conversations replied to', value:report.stats.conversations, icon:MessagesSquare }, { label:'Total replies', value:report.stats.totalReplies, icon:MessageSquareReply },
          { label:'Average replies', value:report.stats.averageReplies, icon:CalendarDays }, { label:'Successfully booked', value:report.stats.successfulBookings, icon:CheckCircle2 },
        ] satisfies Array<{label:string;value:number;icon:LucideIcon}>).map(({label,value,icon:Icon})=><article key={label} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between"><p className="text-sm text-slate-500">{label}</p><Icon className="text-violet-500" size={19}/></div><p className="mt-2 text-3xl font-bold">{value.toLocaleString()}</p></article>)}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between"><h2 className="text-lg font-semibold">Conversation activity</h2><p className="text-sm text-slate-500">First reply by hour · Eastern Time</p></div><div className="mt-8 grid min-h-64 grid-cols-12 items-end gap-2 xl:grid-cols-24">{report.hourly.map((item)=><div key={item.hour} className="flex h-60 flex-col justify-end text-center"><span className="mb-1 text-[10px] text-slate-500">{item.count || ''}</span><div className="mx-auto w-full max-w-8 rounded-t bg-cyan-700" style={{height:`${Math.max(item.count ? 8 : 1,(item.count/maxHour)*190)}px`}}/><span className="mt-2 -rotate-45 whitespace-nowrap text-[10px] text-slate-500">{item.label}</span></div>)}</div>
        <div className="mt-10 border-t pt-5"><h3 className="text-sm font-semibold">By channel</h3><div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">{report.channels.map((channel,index)=><div key={channel.channelId} className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full" style={{backgroundColor:colors[index%colors.length]}}/><span>{channel.channelName}</span><strong>{channel.count.toLocaleString()}</strong></div>)}</div></div>
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex justify-between p-5"><h2 className="text-lg font-semibold">Conversation list</h2><span className="text-sm text-slate-500">{report.conversations.length.toLocaleString()} records</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-y bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Last replied</th><th className="p-3">First replied</th><th className="p-3">Replies</th><th className="p-3">Channel</th><th className="p-3">Respond contact</th><th className="p-3">Booked</th><th className="p-3">Latest reply</th></tr></thead><tbody className="divide-y">{rows.map((row)=><tr key={row.contactId}><td className="p-3 whitespace-nowrap">{easternDateTime(row.lastRepliedAt)}</td><td className="p-3 whitespace-nowrap">{easternDateTime(row.firstRepliedAt)}</td><td className="p-3">{row.replies}</td><td className="p-3">{row.channelId}</td><td className="p-3"><div className="font-medium">{row.contactName}</div><div className="text-xs text-slate-400">ID {row.contactId}</div></td><td className="p-3">{row.booked?<span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Booked</span>:'—'}</td><td className="max-w-md truncate p-3" title={row.latestReply}>{row.latestReply}</td></tr>)}</tbody></table></div><div className="flex items-center justify-end gap-3 border-t p-4 text-sm"><button disabled={page===1} onClick={()=>setPage((value)=>value-1)} className="rounded border px-3 py-1 disabled:opacity-30">Previous</button><span>Page {page} of {totalPages}</span><button disabled={page===totalPages} onClick={()=>setPage((value)=>value+1)} className="rounded border px-3 py-1 disabled:opacity-30">Next</button></div></section>
    </>}
  </div>
}
