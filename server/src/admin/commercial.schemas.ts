import { z } from 'zod'

export const statusSchema = z.enum(['draft', 'published', 'archived'])
export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: statusSchema.optional(),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const common = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(10_000).nullable().optional(),
  status: statusSchema.default('draft'),
  is_active: z.boolean().default(true),
}

export const productSchema = z.object({
  ...common,
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: z.string().trim().max(500).nullable().optional(),
  treatment_category: z.string().trim().max(120).nullable().optional(),
  detailed_information: z.string().trim().max(20_000).nullable().optional(),
})

export const pricingSchema = z.object({
  ...common,
  product_id: z.string().uuid().nullable().optional(),
  price_cents: z.number().int().nonnegative(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  billing_period: z.enum(['one_time', 'weekly', 'monthly', 'custom']),
  effective_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
}).refine((data) => !data.effective_at || !data.expires_at || data.expires_at > data.effective_at, {
  message: 'Expiration must be after the effective date', path: ['expires_at'],
})

export const promotionSchema = z.object({
  ...common,
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().nonnegative(),
  product_id: z.string().uuid().nullable().optional(),
  pricing_package_id: z.string().uuid().nullable().optional(),
  eligibility_conditions: z.string().trim().max(5_000).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
}).refine((data) => data.discount_type !== 'percentage' || data.discount_value <= 100, {
  message: 'Percentage discounts cannot exceed 100', path: ['discount_value'],
}).refine((data) => !data.starts_at || !data.ends_at || data.ends_at > data.starts_at, {
  message: 'End date must be after start date', path: ['ends_at'],
})

export const paymentMethodSchema = z.object({
  name: common.name,
  description: common.description,
  restrictions: z.string().trim().max(5_000).nullable().optional(),
  display_order: z.number().int().nonnegative().default(0),
  is_available: z.boolean().default(true),
  status: statusSchema.default('draft'),
})

export const idSchema = z.string().uuid()
