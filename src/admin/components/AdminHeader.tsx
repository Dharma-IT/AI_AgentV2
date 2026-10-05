import { LogOut, Menu, ShieldCheck } from 'lucide-react'
import { useAdminSession } from '../AdminSession'

export function AdminHeader({ onMenu }: { onMenu: () => void }) {
  const { signOut } = useAdminSession()
  return <header className="flex min-h-18 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6"><button className="rounded-lg p-2 text-slate-600 lg:hidden" onClick={onMenu} aria-label="Open navigation"><Menu size={21} /></button><div className="ml-auto flex items-center gap-3"><span className="flex items-center gap-2 text-xs font-medium text-emerald-700"><ShieldCheck size={15} />Supabase Auth session</span><button onClick={() => void signOut()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Sign out"><LogOut size={18} /></button></div></header>
}
