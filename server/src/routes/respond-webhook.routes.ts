import { createHmac, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { env } from '../config/env.js'
import { processIncomingWebhook } from '../respond/respond-webhook.service.js'

export const respondWebhookRouter = Router()

function equal(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function authorized(headers: Record<string, unknown>, body: unknown, rawBody?: Buffer) {
  const secret = env.RESPOND_WEBHOOK_SIGNING_KEY
  if (!secret) return false
  const authorization = String(headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const direct = String(headers['x-webhook-key'] ?? headers['x-api-key'] ?? '')
  if ((authorization && equal(authorization, secret)) || (direct && equal(direct, secret))) return true
  const supplied = String(headers['x-respond-signature'] ?? headers['x-webhook-signature'] ?? headers['x-signature'] ?? '').replace(/^sha256=/i, '')
  const digest = createHmac('sha256', secret).update(rawBody ?? Buffer.from(JSON.stringify(body))).digest()
  return Boolean(supplied) && (equal(supplied, digest.toString('hex')) || equal(supplied, digest.toString('base64')))
}

respondWebhookRouter.post('/webhook', (request, response) => {
  const rawBody = (request as typeof request & { rawBody?: Buffer }).rawBody
  if (!authorized(request.headers as Record<string, unknown>, request.body, rawBody)) return response.status(401).json({ error: 'Invalid webhook signature' })
  response.status(200).json({ received: true })
  void processIncomingWebhook(request.body).catch((error: unknown) => {
    console.error('Respond webhook processing failed', error instanceof Error ? error.message : error)
  })
})
