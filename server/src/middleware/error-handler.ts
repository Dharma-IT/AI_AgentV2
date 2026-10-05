import type { ErrorRequestHandler } from 'express'
import OpenAI from 'openai'
import { ZodError } from 'zod'
import { ConversationNotFoundError } from '../services/conversation.service.js'
import { DatabaseOperationError } from '../admin/commercial.service.js'

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next
  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Invalid request',
      details: error.issues.map((issue) => issue.message),
    })
    return
  }

  if (error instanceof OpenAI.APIError) {
    console.error('OpenAI request failed', {
      status: error.status,
      requestId: error.requestID,
      message: error.message,
    })
    response.status(502).json({ error: 'Maria is temporarily unavailable' })
    return
  }

  if (error instanceof ConversationNotFoundError) {
    response.status(404).json({ error: error.message })
    return
  }

  if (error instanceof DatabaseOperationError) {
    const status = error.code === 'RELATION_NOT_FOUND' ? 400 : error.code === '23505' ? 409 : 502
    response.status(status).json({ error: error.message })
    return
  }

  console.error('Unexpected server error', error)
  response.status(500).json({ error: 'An unexpected error occurred' })
}
