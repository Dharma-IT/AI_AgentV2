import { Router } from 'express'
import type { ZodType } from 'zod'
import { idSchema, listQuerySchema, paymentMethodSchema, pricingSchema, productSchema, promotionSchema } from '../admin/commercial.schemas.js'
import { commercialService, type CommercialTable } from '../admin/commercial.service.js'
import { requireAdmin } from '../middleware/admin-auth.js'
import { businessRouter } from './business.routes.js'
import { knowledgeHealth, retryFailedEmbeddings } from '../knowledge/knowledge.service.js'
import { retryEmbeddingsSchema } from '../knowledge/knowledge.schemas.js'

export const adminRouter = Router()

adminRouter.use(requireAdmin)
adminRouter.get('/status', (_request, response) => response.json({ authenticated: true, userId: response.locals.user.id, role: response.locals.adminRole }))
adminRouter.get('/knowledge-integration/health', async (_request, response, next) => { try { response.json(await knowledgeHealth()) } catch (error) { next(error) } })
adminRouter.post('/knowledge-integration/retry', async (request, response, next) => { try { const { limit } = retryEmbeddingsSchema.parse(request.body); response.json({ results: await retryFailedEmbeddings(limit) }) } catch (error) { next(error) } })
adminRouter.use(businessRouter)

const resources: Array<{ path: string; table: CommercialTable; schema: ZodType }> = [
  { path: 'products', table: 'products', schema: productSchema },
  { path: 'pricing-packages', table: 'pricing_packages', schema: pricingSchema },
  { path: 'promotions', table: 'promotions', schema: promotionSchema },
  { path: 'payment-methods', table: 'payment_methods', schema: paymentMethodSchema },
]

for (const resource of resources) {
  const base = `/${resource.path}`
  adminRouter.get(base, async (request, response, next) => {
    try { response.json(await commercialService.list(resource.table, listQuerySchema.parse(request.query))) } catch (error) { next(error) }
  })
  adminRouter.get(`${base}/:id`, async (request, response, next) => {
    try {
      const data = await commercialService.get(resource.table, idSchema.parse(request.params.id))
      if (!data) return response.status(404).json({ error: 'Record not found' })
      response.json({ data })
    } catch (error) { next(error) }
  })
  adminRouter.post(base, async (request, response, next) => {
    try { response.status(201).json({ data: await commercialService.create(resource.table, resource.schema.parse(request.body) as Record<string, unknown>, response.locals.user.id) }) } catch (error) { next(error) }
  })
  adminRouter.put(`${base}/:id`, async (request, response, next) => {
    try {
      const data = await commercialService.update(resource.table, idSchema.parse(request.params.id), resource.schema.parse(request.body) as Record<string, unknown>, response.locals.user.id)
      if (!data) return response.status(404).json({ error: 'Record not found' })
      response.json({ data })
    } catch (error) { next(error) }
  })
  adminRouter.post(`${base}/:id/archive`, async (request, response, next) => {
    try { response.json({ data: await commercialService.archive(resource.table, idSchema.parse(request.params.id), response.locals.user.id) }) } catch (error) { next(error) }
  })
  adminRouter.delete(`${base}/:id`, async (request, response, next) => {
    try { response.json({ data: await commercialService.remove(resource.table, idSchema.parse(request.params.id)) }) } catch (error) { next(error) }
  })
}
