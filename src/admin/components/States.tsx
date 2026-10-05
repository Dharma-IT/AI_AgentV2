import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Inbox className="mx-auto text-slate-300" size={30} /><h2 className="mt-3 font-medium text-slate-800">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p></div>
}

export function LoadingState() {
  return <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} /> Loading…</div>
}

export function ErrorState({ message }: { message: string }) {
  return <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} />{message}</div>
}
