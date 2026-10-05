import { Router } from 'express'
import type { ZodType } from 'zod'
import { businessListQuerySchema, businessPolicySchema, clinicInformationSchema, faqSchema, shippingRuleSchema } from '../admin/business.schemas.js'
import { businessService, type BusinessTable } from '../admin/business.service.js'
import { idSchema } from '../admin/commercial.schemas.js'
import { conversationKnowledgeSchema, conversationScenarioSchema, objectionHandlingSchema } from '../admin/conversation-knowledge.schemas.js'

export const businessRouter = Router()
const resources: Array<{ path: string; table: BusinessTable; schema: ZodType }> = [
  { path: 'shipping-rules', table: 'shipping_rules', schema: shippingRuleSchema },
  { path: 'clinic-information', table: 'clinic_information', schema: clinicInformationSchema },
  { path: 'faqs', table: 'faqs', schema: faqSchema },
  { path: 'business-policies', table: 'business_policies', schema: businessPolicySchema },
  { path: 'conversation-knowledge', table: 'conversation_knowledge', schema: conversationKnowledgeSchema },
  { path: 'objection-handling', table: 'objection_handling', schema: objectionHandlingSchema },
  { path: 'conversation-scenarios', table: 'conversation_scenarios', schema: conversationScenarioSchema },
]

for (const resource of resources) {
  const base = `/${resource.path}`
  businessRouter.get(base, async (request, response, next) => { try { response.json(await businessService.list(resource.table, businessListQuerySchema.parse(request.query))) } catch (error) { next(error) } })
  businessRouter.get(`${base}/:id`, async (request, response, next) => { try { const data = await businessService.get(resource.table, idSchema.parse(request.params.id)); if (!data) return response.status(404).json({ error: 'Record not found' }); response.json({ data }) } catch (error) { next(error) } })
  businessRouter.post(base, async (request, response, next) => { try { response.status(201).json({ data: await businessService.create(resource.table, resource.schema.parse(request.body) as Record<string, unknown>, response.locals.user.id) }) } catch (error) { next(error) } })
  businessRouter.put(`${base}/:id`, async (request, response, next) => { try { const data = await businessService.update(resource.table, idSchema.parse(request.params.id), resource.schema.parse(request.body) as Record<string, unknown>, response.locals.user.id); if (!data) return response.status(404).json({ error: 'Record not found' }); response.json({ data }) } catch (error) { next(error) } })
  businessRouter.post(`${base}/:id/archive`, async (request, response, next) => { try { response.json({ data: await businessService.archive(resource.table, idSchema.parse(request.params.id), response.locals.user.id) }) } catch (error) { next(error) } })
  businessRouter.delete(`${base}/:id`, async (request, response, next) => { try { response.json({ data: await businessService.remove(resource.table, idSchema.parse(request.params.id)) }) } catch (error) { next(error) } })
}
