import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryConversationRepository } from '../src/repositories/conversation.repository.js'
import { ConversationService, initialGreeting } from '../src/services/conversation.service.js'
import { generateMariaReply } from '../src/services/maria.service.js'
import { recognizeUSLocation } from '../src/location/us-city-recognition.js'
import type { ConversationState, MessageAnalysis, ResponsePlan } from '../src/domain/conversation.js'
import type { KnowledgeContext, RetrievalInput } from '../src/knowledge/knowledge.types.js'

const emptyKnowledge = (language: 'en' | 'es' | 'pt' = 'en'): KnowledgeContext => ({ requestId: 'test', language, structured: [], guidance: [], compliance: [], metadata: { durationMs: 0, categories: [], recordIds: [], noRelevantKnowledge: true, errors: [] } })

function makeService() {
  const repository = new InMemoryConversationRepository()
  const analyze = async (message: string): Promise<MessageAnalysis> => {
    const location = recognizeUSLocation(message)
    return { detectedLanguage: message.startsWith('ES:') ? 'es' : message.startsWith('PT:') ? 'pt' : 'en', customerWeightGoal: /lose weight|perder peso/i.test(message) ? 'lose weight' : null, customerStateCode: location.stateCode, questionTopics: /book|appointment/i.test(message) ? ['consultation'] : [], appointmentIntent: /book|appointment/i.test(message) ? 'accepts_offer' : 'none', appointmentPreference: null, stateRecognition: location.kind, stateCandidates: location.candidates }
  }
  const retrieve = async ({ state }: RetrievalInput): Promise<KnowledgeContext> => {
    const eligible = state.customerState === 'FL'
    const known = eligible || state.customerState === 'AL'
    return { ...emptyKnowledge(), structured: known ? [{ id: state.customerState!, category: 'shipping', content: `${state.customerState} | ${eligible}`, method: 'structured', sourceType: 'shipping_rules', attributes: { stateCode: state.customerState, isServiceable: eligible } }] : [] }
  }
  const generate = async (_message: string, state: ConversationState, plan: ResponsePlan) => plan.includeSupplementAlternative ? `alternative-${state.preferredLanguage}` : `normal-${state.preferredLanguage}`
  const service = new ConversationService({ repository, analyze, retrieve, generate } as ConstructorParameters<typeof ConversationService>[0])
  return { service, repository }
}

test('every new conversation uses the exact restored greeting once', async () => {
  const expected = `Hello! I'm Maria from Dharma Clinic 🌿

We specialize in personalized weight loss with Semaglutide and Tirzepatide with direct shipping to your home in 43 U.S. states. 📦✨

To better orient yourself, what is your main weight goal right now?`
  assert.equal(initialGreeting, expected)
  const { service, repository } = makeService()
  const first = service.createConversation()
  const second = service.createConversation()
  assert.equal(first.messages[0]?.content, expected)
  assert.equal(second.messages[0]?.content, expected)
  await service.processMessage(first.id, 'I want to lose weight in Florida')
  const ongoing = repository.findById(first.id)
  assert.equal(ongoing?.messages.filter((message) => message.content === expected).length, 1)
})

test('eligible direct state and city continue the consultation flow', async () => {
  for (const location of ['Florida', 'Miami']) {
    const { service } = makeService(); const conversation = service.createConversation()
    const result = await service.processMessage(conversation.id, `I want to lose weight in ${location}`)
    assert.equal(result.state.customerState, 'FL'); assert.equal(result.state.stateEligibility, 'serviceable'); assert.equal(result.state.alternativeFlowActive, false); assert.equal(result.state.currentStage, 'appointment')
  }
})

test('choosing an offered slot advances to phone collection without another confirmation', async () => {
  const repository = new InMemoryConversationRepository()
  const slot = { startTime: '2026-10-06T14:40:00.000Z', endTime: '2026-10-06T15:00:00.000Z', timezone: 'America/New_York', timezoneLabel: 'Eastern Time', hubspotUserId: 77394932, meetingLinkSlug: 'arles-martinez' }
  const service = new ConversationService({
    repository,
    analyze: async (message: string): Promise<MessageAnalysis> => message.includes('first')
      ? { detectedLanguage: 'en', customerWeightGoal: null, customerStateCode: null, questionTopics: [], appointmentIntent: 'accepts_offer', appointmentPreference: 'first', stateRecognition: 'none', stateCandidates: [] }
      : message.includes('Florida')
        ? { detectedLanguage: 'en', customerWeightGoal: 'lose weight', customerStateCode: 'FL', questionTopics: [], appointmentIntent: 'none', appointmentPreference: null, stateRecognition: 'exact', stateCandidates: ['FL'] }
        : { detectedLanguage: 'en', customerWeightGoal: null, customerStateCode: null, questionTopics: [], appointmentIntent: 'none', appointmentPreference: null, stateRecognition: 'none', stateCandidates: [] },
    retrieve: async (): Promise<KnowledgeContext> => ({ ...emptyKnowledge(), structured: [{ id: 'FL', category: 'shipping', content: 'eligible', method: 'structured', sourceType: 'shipping_rules', attributes: { stateCode: 'FL', isServiceable: true } }] }),
    generate: async (_message: string, _state: ConversationState, plan: ResponsePlan) => plan.bookingDetailRequest === 'phone' ? 'Please provide your phone number.' : plan.bookingDetailRequest === 'full_name' ? 'Please provide your full name.' : plan.bookingDetailsComplete ? 'Details received.' : 'Choose a slot.',
    findAvailability: async () => [slot],
    bookAppointment: async () => ({ booking: { calendarEventId: 'event', contactId: 'contact' }, confirmation: 'Details received.' }),
  })
  const conversation = service.createConversation()
  await service.processMessage(conversation.id, 'I want to lose weight in Florida')
  const result = await service.processMessage(conversation.id, 'I choose the first one')

  assert.equal(result.state.currentStage, 'booking_details')
  assert.equal(result.state.lastAskedQuestion, 'phone')
  assert.equal(result.state.selectedAppointmentSlot?.startTime, slot.startTime)
  assert.equal(result.plan.appointmentSlots?.length, 0)
  assert.equal(result.reply, 'Please provide your phone number.')

  const phoneResult = await service.processMessage(conversation.id, '1 561 705 8848')
  assert.equal(phoneResult.state.customerPhone, '15617058848')
  assert.equal(phoneResult.state.lastAskedQuestion, 'full_name')
  assert.equal(phoneResult.reply, 'Please provide your full name.')

  const nameResult = await service.processMessage(conversation.id, 'Jane Doe')
  assert.equal(nameResult.state.customerFullName, 'Jane Doe')
  assert.equal(nameResult.state.currentStage, 'complete')
  assert.equal(nameResult.state.lastAskedQuestion, null)
  assert.equal(nameResult.reply, 'Details received.')
})

test('typing an offered local time selects it without reconfirmation', async () => {
  const repository = new InMemoryConversationRepository()
  const slot = { startTime: '2026-10-06T14:40:00.000Z', endTime: '2026-10-06T15:00:00.000Z', timezone: 'America/New_York', timezoneLabel: 'Eastern Time', hubspotUserId: 77394932, meetingLinkSlug: 'arles-martinez' }
  const service = new ConversationService({
    repository,
    analyze: async (message: string): Promise<MessageAnalysis> => message.includes('Florida')
      ? { detectedLanguage: 'en', customerWeightGoal: 'lose weight', customerStateCode: 'FL', questionTopics: [], appointmentIntent: 'none', appointmentPreference: null, stateRecognition: 'exact', stateCandidates: ['FL'] }
      : { detectedLanguage: 'en', customerWeightGoal: null, customerStateCode: null, questionTopics: [], appointmentIntent: 'specific_time', appointmentPreference: '10:40 AM', stateRecognition: 'none', stateCandidates: [] },
    retrieve: async (): Promise<KnowledgeContext> => ({ ...emptyKnowledge(), structured: [{ id: 'FL', category: 'shipping', content: 'eligible', method: 'structured', sourceType: 'shipping_rules', attributes: { stateCode: 'FL', isServiceable: true } }] }),
    generate: async (_message: string, _state: ConversationState, plan: ResponsePlan) => plan.bookingDetailRequest === 'phone' ? 'Please provide your phone number.' : 'Choose a slot.',
    findAvailability: async () => [slot],
  })
  const conversation = service.createConversation()
  await service.processMessage(conversation.id, 'I want to lose weight in Florida')
  const result = await service.processMessage(conversation.id, '10:40AM')

  assert.equal(result.state.selectedAppointmentSlot?.startTime, slot.startTime)
  assert.equal(result.state.lastAskedQuestion, 'phone')
  assert.equal(result.reply, 'Please provide your phone number.')
})

test('replying with choice B selects the corresponding offered slot', async () => {
  const repository = new InMemoryConversationRepository()
  const slots = [
    { startTime: '2026-10-06T14:40:00.000Z', endTime: '2026-10-06T15:00:00.000Z', timezone: 'America/New_York', timezoneLabel: 'Eastern Time', hubspotUserId: 77394932, meetingLinkSlug: 'arles-martinez' },
    { startTime: '2026-10-06T16:20:00.000Z', endTime: '2026-10-06T16:40:00.000Z', timezone: 'America/New_York', timezoneLabel: 'Eastern Time', hubspotUserId: 79527842, meetingLinkSlug: 'brayam-zuluaga' },
  ]
  const service = new ConversationService({
    repository,
    analyze: async (message: string): Promise<MessageAnalysis> => message.includes('Florida')
      ? { detectedLanguage: 'en', customerWeightGoal: 'lose weight', customerStateCode: 'FL', questionTopics: [], appointmentIntent: 'none', appointmentPreference: null, stateRecognition: 'exact', stateCandidates: ['FL'] }
      : { detectedLanguage: 'en', customerWeightGoal: null, customerStateCode: null, questionTopics: [], appointmentIntent: 'accepts_offer', appointmentPreference: message, stateRecognition: 'none', stateCandidates: [] },
    retrieve: async (): Promise<KnowledgeContext> => ({ ...emptyKnowledge(), structured: [{ id: 'FL', category: 'shipping', content: 'eligible', method: 'structured', sourceType: 'shipping_rules', attributes: { stateCode: 'FL', isServiceable: true } }] }),
    generate: async (_message: string, _state: ConversationState, plan: ResponsePlan) => plan.bookingDetailRequest === 'phone' ? 'phone' : 'slots',
    findAvailability: async () => slots,
  })
  const conversation = service.createConversation()
  await service.processMessage(conversation.id, 'I want to lose weight in Florida')
  const result = await service.processMessage(conversation.id, 'B')

  assert.equal(result.state.selectedAppointmentSlot?.startTime, slots[1]?.startTime)
  assert.equal(result.state.lastAskedQuestion, 'phone')
})

test('Florida location-first variants stay eligible and never enter the supplement branch', async () => {
  const variants = ['I am from florida', 'Florida', 'FL', 'I live in Florida', "I'm from Florida"]
  for (const message of variants) {
    const { service } = makeService()
    const conversation = service.createConversation()
    const result = await service.processMessage(conversation.id, message)
    assert.equal(result.state.customerState, 'FL', message)
    assert.equal(result.state.stateEligibility, 'serviceable', message)
    assert.equal(result.state.alternativeFlowActive, false, message)
    assert.equal(result.plan.includeSupplementAlternative, false, message)
    assert.equal(result.reply.includes('alternative'), false, message)
    assert.equal(result.state.currentStage, 'weight_goal', message)
    assert.equal(result.plan.nextQuestion, 'weight_goal', message)
  }
})

test('shared eligible pipeline handles names, abbreviations, and multi-sentence messages', async () => {
  const eligible: Array<[string, string]> = [
    ['I am in Texas. I have a few questions before sharing my goal.', 'TX'],
    ['CA', 'CA'],
    ['I recently moved. My current state is New York.', 'NY'],
    ['Washington', 'WA'],
  ]
  for (const [message, expectedCode] of eligible) {
    const repository = new InMemoryConversationRepository()
    const location = recognizeUSLocation(message)
    const service = new ConversationService({
      repository,
      analyze: async () => ({ detectedLanguage: 'en', customerWeightGoal: null, customerStateCode: location.stateCode, questionTopics: [], appointmentIntent: 'none', appointmentPreference: null, stateRecognition: location.kind, stateCandidates: location.candidates }),
      retrieve: async ({ state }: RetrievalInput) => ({ ...emptyKnowledge(), structured: [{ id: state.customerState!, category: 'shipping', content: 'eligible', method: 'structured', sourceType: 'shipping_rules', attributes: { stateCode: state.customerState, isServiceable: true } }] }),
      generate: async () => 'normal',
    } as ConstructorParameters<typeof ConversationService>[0])
    const conversation = service.createConversation()
    const result = await service.processMessage(conversation.id, message)
    assert.equal(result.state.customerState, expectedCode)
    assert.equal(result.state.stateEligibility, 'serviceable')
    assert.equal(result.state.alternativeFlowActive, false)
  }
})

test('ineligible direct state and city enter the supplement branch and suppress booking', async () => {
  for (const message of ['I want to lose weight in Alabama', 'I want to lose weight in Birmingham', 'I want to book an appointment in Alabama']) {
    const { service } = makeService(); const conversation = service.createConversation()
    const result = await service.processMessage(conversation.id, message)
    assert.equal(result.state.customerState, 'AL'); assert.equal(result.state.stateEligibility, 'unserviceable'); assert.equal(result.state.alternativeFlowActive, true); assert.equal(result.state.appointmentStageActive, false); assert.equal(result.plan.acknowledgeAppointmentPreference, false)
  }
})

test('state corrections move in both directions without locking the branch', async () => {
  const first = makeService(); let conversation = first.service.createConversation()
  await first.service.processMessage(conversation.id, 'I want to lose weight in Alabama')
  let result = await first.service.processMessage(conversation.id, 'Actually I live in Florida')
  assert.equal(result.state.alternativeFlowActive, false); assert.equal(result.state.currentStage, 'appointment')

  const second = makeService(); conversation = second.service.createConversation()
  await second.service.processMessage(conversation.id, 'I want to lose weight in Florida')
  result = await second.service.processMessage(conversation.id, 'Actually I live in Alabama')
  assert.equal(result.state.alternativeFlowActive, true); assert.equal(result.state.appointmentStageActive, false)
})

test('approved sales facts are each scheduled once and tracked independently', async () => {
  const repository = new InMemoryConversationRepository()
  const plans: ResponsePlan[] = []
  const location = recognizeUSLocation('Florida')
  const service = new ConversationService({
    repository,
    analyze: async () => ({ detectedLanguage: 'en', customerWeightGoal: 'Lose 20 pounds', customerStateCode: location.stateCode, questionTopics: [], appointmentIntent: 'none', appointmentPreference: null, stateRecognition: location.kind, stateCandidates: location.candidates }),
    retrieve: async ({ state }: RetrievalInput) => ({ ...emptyKnowledge(), structured: [
      { id: 'shipping', sourceType: 'shipping_rules', category: 'shipping', content: 'FL | true', method: 'structured', attributes: { stateCode: state.customerState, isServiceable: true } },
      { id: 'clinic', sourceType: 'clinic_information', category: 'clinic', content: 'Free consultation', method: 'structured' },
      { id: 'promotion', sourceType: 'promotions', category: 'promotions', content: 'Current promotion', method: 'structured' },
      { id: 'pricing', sourceType: 'pricing_packages', category: 'pricing', content: 'Current starting price', method: 'structured' },
      { id: 'payment', sourceType: 'payment_methods', category: 'payment_methods', content: 'Installment option', method: 'structured' },
    ] }),
    generate: async (_message: string, _state: ConversationState, plan: ResponsePlan) => { plans.push({ ...plan }); return 'guided response' },
  } as ConstructorParameters<typeof ConversationService>[0])
  const conversation = service.createConversation()
  const first = await service.processMessage(conversation.id, 'I want to lose 20 pounds in Florida')
  await service.processMessage(conversation.id, 'Can you explain more?')
  assert.equal(first.state.consultationIntroSent, true)
  assert.equal(first.state.promotionIntroSent, true)
  assert.equal(first.state.startingPriceSent, true)
  assert.equal(first.state.paymentOptionsSent, true)
  assert.equal(plans[0]?.includeConsultationIntro, true)
  assert.equal(plans[0]?.includePromotionIntro, true)
  assert.equal(plans[0]?.includeStartingPrice, true)
  assert.equal(plans[0]?.includePaymentOptions, true)
  assert.equal(plans[1]?.includeConsultationIntro, false)
  assert.equal(plans[1]?.includePromotionIntro, false)
  assert.equal(plans[1]?.includeStartingPrice, false)
  assert.equal(plans[1]?.includePaymentOptions, false)
})

test('ineligible alternative message is localized and preserves the exact URL', async () => {
  const baseState = makeService().service.createConversation()
  const basePlan: ResponsePlan = { answerTopics: [], acknowledgeGoal: false, includeConsultationIntro: false, includePromotionIntro: false, includeStartingPrice: false, includePaymentOptions: false, acknowledgeAppointmentPreference: false, stateEligibility: 'unserviceable', nextQuestion: null, clarifyState: false, includeSupplementAlternative: true }
  const messages = await Promise.all((['en', 'es', 'pt'] as const).map((language) => generateMariaReply('', { ...baseState, preferredLanguage: language }, basePlan, emptyKnowledge(language))))
  assert.match(messages[0], /^Thank you for sharing your location! ❤️/)
  assert.match(messages[1], /^¡Gracias por compartir tu ubicación! ❤️/)
  assert.match(messages[2], /^Obrigada por compartilhar sua localização! ❤️/)
  for (const message of messages) assert.equal(message.match(/https:\/\/dharmanutritionclinic\.com\/collections\/supplements/g)?.length, 1)
})
