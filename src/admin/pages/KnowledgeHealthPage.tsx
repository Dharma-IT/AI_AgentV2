import { useEffect, useState } from 'react'
import { Activity, Database, RefreshCw, Search, Sparkles } from 'lucide-react'
import { adminFetch, useAdminSession } from '../AdminSession'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { ErrorState, LoadingState } from '../components/States'

type Health = { database: string; retrieval: string; embeddings: string; eligiblePublished: number; embedded: number; pending: number; failed: number; lastSynchronizedAt: string | null; model: string }

async function requestHealth(accessToken: string) {
  const response = await adminFetch(accessToken, '/knowledge-integration/health')
  if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? 'Unable to load knowledge health')
  return response.json() as Promise<Health>
}

export function KnowledgeHealthPage() {
  const { session } = useAdminSession()
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  useEffect(() => {
    if (!session) return
    let active = true
    void requestHealth(session.access_token).then((value) => { if (active) setHealth(value) }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load knowledge health') })
    return () => { active = false }
  }, [session])
  async function retry() {
    if (!session) return
    setRetrying(true); setError('')
    const response = await adminFetch(session.access_token, '/knowledge-integration/retry', { method: 'POST', body: JSON.stringify({ limit: 25 }) })
    if (!response.ok) setError((await response.json() as { error?: string }).error ?? 'Retry failed')
    try { setHealth(await requestHealth(session.access_token)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load knowledge health') }
    setRetrying(false)
  }
  if (error && !health) return <ErrorState message={error} />
  if (!health) return <LoadingState />
  return <div className="space-y-7">
    <PageHeader title="Knowledge integration health" description="Live retrieval and embedding synchronization state." />
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Eligible published" value={String(health.eligiblePublished)} icon={Search} />
      <StatCard label="Embedded" value={String(health.embedded)} icon={Sparkles} />
      <StatCard label="Awaiting embeddings" value={String(health.pending)} icon={Activity} />
      <StatCard label="Failed" value={String(health.failed)} icon={Database} />
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="font-medium text-slate-900">Database</dt><dd>{health.database}</dd></div><div><dt className="font-medium text-slate-900">Retrieval service</dt><dd>{health.retrieval}</dd></div><div><dt className="font-medium text-slate-900">Embedding service</dt><dd>{health.embeddings} ({health.model})</dd></div><div><dt className="font-medium text-slate-900">Last synchronization</dt><dd>{health.lastSynchronizedAt ? new Date(health.lastSynchronizedAt).toLocaleString() : 'No successful synchronization yet'}</dd></div></dl>
      <button onClick={() => void retry()} disabled={retrying || health.failed === 0} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />{retrying ? 'Retrying…' : 'Retry failed embeddings'}</button>
    </section>
  </div>
}
