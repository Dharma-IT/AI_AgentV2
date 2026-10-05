import { z } from 'zod'
import { statusSchema } from './commercial.schemas.js'

const language = z.enum(['en', 'es', 'pt']).default('en')
const keywords = z.array(z.string().trim().min(1).max(100)).max(40).default([])
const priority = z.number().int().min(0).max(1000).default(0)

export const conversationKnowledgeSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(5_000).nullable().optional(),
  category: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(50_000),
  language_code: language,
  keywords,
  priority,
  version: z.string().trim().max(50).nullable().optional(),
  status: statusSchema.default('draft'),
})

export const objectionHandlingSchema = z.object({
  title: z.string().trim().min(1).max(240),
  category: z.string().trim().min(1).max(160),
  objection: z.string().trim().min(1).max(10_000),
  guidance: z.string().trim().min(1).max(30_000),
  follow_up_question: z.string().trim().max(5_000).nullable().optional(),
  additional_context: z.string().trim().max(10_000).nullable().optional(),
  language_code: language,
  keywords,
  priority,
  version: z.string().trim().max(50).nullable().optional(),
  status: statusSchema.default('draft'),
})

export const conversationScenarioSchema = z.object({
  name: z.string().trim().min(1).max(240),
  category: z.string().trim().min(1).max(160),
  description: z.string().trim().max(10_000).nullable().optional(),
  customer_message: z.string().trim().min(1).max(10_000),
  conversation_context: z.string().trim().max(20_000).nullable().optional(),
  expected_behavior: z.string().trim().min(1).max(30_000),
  response_guidance: z.string().trim().min(1).max(30_000),
  expected_next_action: z.string().trim().max(10_000).nullable().optional(),
  language_code: language,
  keywords,
  priority,
  version: z.string().trim().max(50).nullable().optional(),
  status: statusSchema.default('draft'),
}).transform((data) => ({ ...data, trigger_description: data.customer_message }))
