import { z } from 'zod'

export const respondChannelIdSchema = z.coerce.number().int().positive()
export const respondSourceSchema = z.string().trim().min(1).max(100).regex(/^[a-z0-9_]+$/)
export const respondChannelToggleSchema = z.object({ enabled: z.boolean() })
