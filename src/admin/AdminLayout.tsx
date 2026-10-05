import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminSessionProvider, useAdminSession } from './AdminSession'
import { AdminHeader } from './components/AdminHeader'
import { AdminSidebar } from './components/AdminSidebar'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { LoadingState } from './components/States'

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { session, loading, authorized } = useAdminSession()
  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50"><div className="w-full max-w-sm"><LoadingState /></div></main>
  if (!session || !authorized) return <AdminLoginPage />
  return <div className="flex min-h-screen bg-slate-50 text-slate-900"><AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="flex min-w-0 flex-1 flex-col"><AdminHeader onMenu={() => setSidebarOpen(true)} /><main className="flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main></div></div>
}

export function AdminLayout() { return <AdminSessionProvider><ProtectedLayout /></AdminSessionProvider> }
