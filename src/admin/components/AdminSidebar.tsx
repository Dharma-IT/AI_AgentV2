import { Bot, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { adminNavigation } from '../admin-navigation'

type Props = { open: boolean; onClose: () => void }

export function AdminSidebar({ open, onClose }: Props) {
  return (
    <>
      {open && <button className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-18 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-violet-600 p-2 text-white"><Bot size={20} /></span><div><p className="font-semibold text-slate-900">Maria Admin</p><p className="text-xs text-slate-500">Dharma Clinic</p></div></div>
          <button className="p-2 text-slate-500 lg:hidden" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {adminNavigation.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} end={path === '/admin'} onClick={onClose} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? 'bg-violet-50 font-medium text-violet-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <a href="/" className="m-3 rounded-xl border border-slate-200 px-3 py-2.5 text-center text-sm text-slate-600 hover:bg-slate-50">Open Maria chat</a>
      </aside>
    </>
  )
}
