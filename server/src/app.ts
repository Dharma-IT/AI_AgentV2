import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { chatRouter, conversationRouter } from './routes/chat.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { supabaseStatus } from './lib/supabase.js'
import { checkSupabaseHealth } from './services/supabase-health.service.js'
import { respondWebhookRouter } from './routes/respond-webhook.routes.js'

export const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb', verify: (request, _response, buffer) => {
  ;(request as typeof request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer)
} }))

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
app.use('/api/respond', respondWebhookRouter)
app.use(errorHandler)
