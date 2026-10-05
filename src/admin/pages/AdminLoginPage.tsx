import { type FormEvent, useState } from 'react'
import { Bot, LoaderCircle } from 'lucide-react'
import { useAdminSession } from '../AdminSession'

export function AdminLoginPage() {
  const { signIn, loading, authError } = useAdminSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    try { await signIn(email, password) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Login failed') }
  }
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-4"><form onSubmit={(event) => void submit(event)} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl"><span className="inline-grid rounded-2xl bg-violet-600 p-3 text-white"><Bot /></span><h1 className="mt-5 text-2xl font-semibold text-slate-950">Maria Admin</h1><p className="mt-1 text-sm text-slate-500">Sign in with your Supabase administrator account.</p>{(error || authError) && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error || authError}</p>}<div className="mt-6 space-y-4"><label className="block text-sm text-slate-700">Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="block text-sm text-slate-700">Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-medium text-white disabled:opacity-50">{loading && <LoaderCircle className="animate-spin" size={17} />}Sign in</button></div></form></main>
}
