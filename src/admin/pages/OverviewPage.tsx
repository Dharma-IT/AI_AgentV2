import { BookOpen, Boxes, FileCheck2, FileClock, Megaphone } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'

const demoStats = [
  { label: 'Total knowledge entries', value: '—', icon: BookOpen },
  { label: 'Published knowledge', value: '—', icon: FileCheck2 },
  { label: 'Draft knowledge', value: '—', icon: FileClock },
  { label: 'Total products', value: '—', icon: Boxes },
  { label: 'Active promotions', value: '—', icon: Megaphone },
]

export function OverviewPage() {
  return <div className="space-y-7"><PageHeader title="Dashboard overview" description="Maria's authenticated clinic knowledge administration workspace." /><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><strong>Database connected.</strong> Commercial management is active. Overview aggregation remains pending, so blank statistics are not database counts.</div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{demoStats.map((stat) => <StatCard key={stat.label} {...stat} />)}</section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Recently updated knowledge</h2><p className="mt-1 text-sm text-slate-500">A cross-resource activity feed is not implemented yet.</p><div className="mt-5 rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">No aggregated records to display</div></section></div>
}
