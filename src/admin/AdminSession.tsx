/* eslint-disable react-refresh/only-export-components */
import type { Session } from '@supabase/supabase-js'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type SessionContext = {
  session: Session | null
  loading: boolean
  authorized: boolean
  authError: string
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Context = createContext<SessionContext | null>(null)

async function verifyAdministrator(session: Session) {
  const response = await fetch('/api/admin/status', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json')
      ? await response.json() as { error?: string }
      : null
    if (response.status === 404 && !body) {
      throw new Error('The admin API is out of date. Restart the development server and try again.')
    }
    throw new Error(body?.error ?? 'Administrator access required')
  }
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    const applySession = async (nextSession: Session | null) => {
      if (!active) return
      setSession(nextSession)
      setAuthorized(false)
      setAuthError('')
      if (!nextSession) { setLoading(false); return }
      try {
        await verifyAdministrator(nextSession)
        if (active) setAuthorized(true)
      } catch (cause) {
        if (active) setAuthError(cause instanceof Error ? cause.message : 'Administrator access required')
      } finally {
        if (active) setLoading(false)
      }
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) { setAuthError(error.message); setLoading(false); return }
      void applySession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true)
      void applySession(nextSession)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  async function signIn(email: string, password: string) {
    setLoading(true); setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setLoading(false); throw new Error(error.message) }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    setSession(null); setAuthorized(false)
  }

  return <Context.Provider value={{ session, loading, authorized, authError, signIn, signOut }}>{children}</Context.Provider>
}

export function useAdminSession() {
  const value = useContext(Context)
  if (!value) throw new Error('Admin session provider is missing')
  return value
}

export async function adminFetch(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...init?.headers },
  })
  return response
}
