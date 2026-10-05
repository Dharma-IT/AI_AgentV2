import { Router } from 'express'
import { z } from 'zod'
import { conversationService, publicState } from '../services/conversation.service.js'

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4_000),
})

export const chatRouter = Router()

chatRouter.post('/', async (request, response, next) => {
  try {
    const input = chatRequestSchema.parse(request.body)
    const conversation = input.conversationId
      ? null
      : conversationService.createConversation()
    const conversationId = input.conversationId ?? conversation!.id
    const result = await conversationService.processMessage(conversationId, input.message)

    response.json({ conversationId, ...result })
  } catch (error) {
    next(error)
  }
})

export const conversationRouter = Router()

conversationRouter.post('/', (_request, response) => {
  const state = conversationService.createConversation()
  response.status(201).json({
    conversationId: state.id,
    message: state.messages[0]?.content,
    state: publicState(state),
  })
})
