import type { RequestHandler } from 'express'
import { supabaseAdminClient, supabaseAuthClient, supabaseStatus } from '../lib/supabase.js'

export const requireAdmin: RequestHandler = async (request, response, next) => {
  if (!supabaseStatus.configured || !supabaseAuthClient || !supabaseAdminClient) {
    response.status(503).json({
      error: 'Admin authentication is not configured',
      code: 'SUPABASE_NOT_CONFIGURED',
    })
    return
  }

  const authorization = request.header('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null

  if (!token) {
    response.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const { data, error } = await supabaseAuthClient.auth.getUser(token)
    if (error || !data.user) {
      response.status(401).json({ error: 'Invalid or expired session' })
      return
    }

    const admin = await supabaseAdminClient
      .from('admin_users')
      .select('role,is_active')
      .eq('id', data.user.id)
      .maybeSingle()

    if (admin.error) {
      response.status(503).json({ error: 'Admin authorization database is unavailable' })
      return
    }

    if (!admin.data?.is_active) {
      response.status(403).json({ error: 'Administrator access required' })
      return
    }

    response.locals.user = data.user
    response.locals.adminRole = admin.data.role
    next()
  } catch (error) {
    next(error)
  }
}
