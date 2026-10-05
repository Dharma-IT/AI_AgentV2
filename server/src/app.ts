import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { chatRouter, conversationRouter } from './routes/chat.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { supabaseStatus } from './lib/supabase.js'
import { checkSupabaseHealth } from './services/supabase-health.service.js'

export const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', async (_request, response, next) => {
  try {
    const database = await checkSupabaseHealth()
  response.json({
    status: 'ok',
    service: 'maria-api',
    model: env.OPENAI_MODEL,
    integrations: {
      supabase: supabaseStatus.configured ? 'configured' : 'not_configured',
    },
    database,
  })
  } catch (error) {
    next(error)
  }
})

app.use('/api/chat', chatRouter)
app.use('/api/conversations', conversationRouter)
app.use('/api/admin', adminRouter)
app.use(errorHandler)
