import { z } from 'zod'

export const retryEmbeddingsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
})

