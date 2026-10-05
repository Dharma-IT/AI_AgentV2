import { z } from 'zod'
import { statusSchema } from './commercial.schemas.js'

export const businessListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: statusSchema.optional(),
  category: z.string().trim().max(120).optional(),
  language: z.enum(['en', 'es', 'pt']).optional(),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const shippingRuleSchema = z.object({
  state_name: z.string().trim().min(1).max(100),
  state_code: z.string().trim().length(2).transform((value) => value.toUpperCase()).refine((value) => /^[A-Z]{2}$/.test(value), 'Invalid state code'),
  is_serviceable: z.boolean(),
  description: z.string().trim().max(5_000).nullable().optional(),
  estimated_delivery_timeframe: z.string().trim().max(500).nullable().optional(),
  restrictions: z.string().trim().max(5_000).nullable().optional(),
  notes: z.string().trim().max(5_000).nullable().optional(),
  is_active: z.boolean().default(true),
  status: statusSchema.default('draft'),
})

export const clinicInformationSchema = z.object({
  clinic_name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).nullable().optional(),
  location: z.string().trim().max(2_000).nullable().optional(),
  contact_information: z.string().trim().max(2_000).nullable().optional(),
  operating_hours: z.string().trim().max(5_000).nullable().optional(),
  consultation_information: z.string().trim().max(10_000).nullable().optional(),
  general_service_information: z.string().trim().max(10_000).nullable().optional(),
  website_url: z.string().url().nullable().optional(),
  social_links: z.record(z.string(), z.string().url()).default({}),
  additional_information: z.string().trim().max(10_000).nullable().optional(),
  status: statusSchema.default('draft'),
})

export const faqSchema = z.object({
  question: z.string().trim().min(1).max(2_000),
  answer: z.string().trim().min(1).max(20_000),
  category: z.string().trim().min(1).max(120),
  keywords: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  language_code: z.enum(['en', 'es', 'pt']).default('en'),
  display_order: z.number().int().nonnegative().default(0),
  status: statusSchema.default('draft'),
})

export const businessPolicySchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5_000).nullable().optional(),
  content: z.string().trim().min(1).max(50_000),
  applicable_conditions: z.string().trim().max(10_000).nullable().optional(),
  effective_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  language_code: z.enum(['en', 'es', 'pt']).default('en'),
  version: z.string().trim().max(50).nullable().optional(),
  status: statusSchema.default('draft'),
}).refine((data) => !data.effective_at || !data.expires_at || data.expires_at > data.effective_at, {
  message: 'Expiration must be after the effective date', path: ['expires_at'],
})
