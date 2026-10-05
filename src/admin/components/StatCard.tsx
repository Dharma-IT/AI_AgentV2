import type { LucideIcon } from 'lucide-react'

export function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-400">Not aggregated</p></div><span className="rounded-xl bg-violet-50 p-2.5 text-violet-600"><Icon size={20} /></span></div></article>
}
