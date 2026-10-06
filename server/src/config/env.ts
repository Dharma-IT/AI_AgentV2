import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().min(1).default('gpt-4.1-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_DB_PASSWORD: z.string().optional().default(''),
  RESPOND_API_TOKEN: z.string().optional().default(''),
  RESPOND_WEBHOOK_SIGNING_KEY: z.string().optional().default(''),
  MARIA_WELCOME_IMAGE_URL: z.string().url().optional().or(z.literal('')),
  MARIA_BOOKING_VIDEO_URL: z.string().url().optional().or(z.literal('')),
  HUBSPOT_PRIVATE_APP_TOKEN: z.string().optional().default(''),
  AIRCALL_API_ID: z.string().optional().default(''),
  AIRCALL_API_TOKEN: z.string().optional().default(''),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ')
  throw new Error(`Invalid environment configuration: ${details}`)
}

export const env = result.data
