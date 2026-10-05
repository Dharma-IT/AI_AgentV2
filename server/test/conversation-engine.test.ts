import assert from 'node:assert/strict'
import test from 'node:test'
import type { ConversationState, MessageAnalysis } from '../src/domain/conversation.js'
import { applyMessageAnalysis } from '../src/services/conversation-engine.js'

function state(): ConversationState {
  const now = new Date().toISOString()
  return {
    id: 'test',
    currentStage: 'weight_goal',
    customerWeightGoal: null,
    customerState: null,
    stateEligibility: null,
    preferredLanguage: 'en',
    introductionSent: true,
    empathyResponseSent: false,
    consultationIntroSent: false,
    promotionIntroSent: false,
    startingPriceSent: false,
    paymentOptionsSent: false,
    appointmentOfferSent: false,
    appointmentStageActive: false,
    alternativeFlowActive: false,
    supplementAlternativeSent: false,
    selectedAppointmentPreference: null,
    conversationStatus: 'active',
    lastAskedQuestion: 'weight_goal',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function analysis(overrides: Partial<MessageAnalysis> = {}): MessageAnalysis {
  return {
    detectedLanguage: 'en',
    customerWeightGoal: null,
    customerStateCode: null,
    questionTopics: [],
    appointmentIntent: 'none',
    appointmentPreference: null,
    ...overrides,
  }
}

test('scenario 1: normal conversation advances through goal, state, and appointment', () => {
  const conversation = state()
  const goalPlan = applyMessageAnalysis(conversation, analysis({ customerWeightGoal: 'Lose 25 pounds' }))
  assert.equal(goalPlan.acknowledgeGoal, true)
  assert.equal(conversation.currentStage, 'state')
  assert.equal(goalPlan.nextQuestion, 'state')

  const statePlan = applyMessageAnalysis(conversation, analysis({ customerStateCode: 'FL' }))
  assert.equal(conversation.currentStage, 'appointment')
  assert.equal(statePlan.includeConsultationIntro, true)
  assert.equal(statePlan.includePromotionIntro, true)
  assert.equal(conversation.appointmentOfferSent, true)
})

test('scenario 2: treatment interruption keeps weight-goal collection active', () => {
  const conversation = state()
  const plan = applyMessageAnalysis(conversation, analysis({ questionTopics: ['treatments'] }))
  assert.deepEqual(plan.answerTopics, ['treatments'])
  assert.equal(plan.nextQuestion, 'weight_goal')
})

test('scenario 3: pricing interruption keeps state collection active', () => {
  const conversation = state()
  applyMessageAnalysis(conversation, analysis({ customerWeightGoal: 'Lose weight' }))
  const plan = applyMessageAnalysis(conversation, analysis({ questionTopics: ['pricing'] }))
  assert.deepEqual(plan.answerTopics, ['pricing'])
  assert.equal(plan.nextQuestion, 'state')
})

test('scenario 4: goal and state in one message skip both collection questions', () => {
  const conversation = state()
  const plan = applyMessageAnalysis(conversation, analysis({
    customerWeightGoal: 'Lose 15 pounds',
    customerStateCode: 'FL',
  }))
  assert.equal(conversation.customerWeightGoal, 'Lose 15 pounds')
  assert.equal(conversation.customerState, 'FL')
  assert.equal(plan.nextQuestion, 'appointment')
})

test('scenario 5: appointment questions do not repeat consultation or promotion', () => {
  const conversation = state()
  applyMessageAnalysis(conversation, analysis({ customerWeightGoal: 'Lose weight', customerStateCode: 'FL' }))
  const paymentPlan = applyMessageAnalysis(conversation, analysis({ questionTopics: ['payment_methods'] }))
  const pricingPlan = applyMessageAnalysis(conversation, analysis({ questionTopics: ['pricing'] }))
  assert.equal(paymentPlan.includeConsultationIntro, false)
  assert.equal(paymentPlan.includePromotionIntro, false)
  assert.equal(pricingPlan.includeConsultationIntro, false)
  assert.equal(pricingPlan.includePromotionIntro, false)
  assert.equal(pricingPlan.nextQuestion, 'appointment')
})

test('scenario 6: a corrected state replaces the prior state', () => {
  const conversation = state()
  applyMessageAnalysis(conversation, analysis({ customerWeightGoal: 'Lose weight', customerStateCode: 'FL' }))
  applyMessageAnalysis(conversation, analysis({ customerStateCode: 'NY' }))
  assert.equal(conversation.customerState, 'NY')
  assert.equal(conversation.stateEligibility, 'unknown')
  assert.equal(conversation.conversationStatus, 'needs_staff')
})

test('scenario 7: language switching preserves context and changes preference', () => {
  const conversation = state()
  applyMessageAnalysis(conversation, analysis({ customerWeightGoal: 'Lose 20 pounds' }))
  applyMessageAnalysis(conversation, analysis({ detectedLanguage: 'es', questionTopics: ['pricing'] }))
  assert.equal(conversation.preferredLanguage, 'es')
  assert.equal(conversation.customerWeightGoal, 'Lose 20 pounds')
  assert.equal(conversation.currentStage, 'state')
})

test('scenario 8: alternate appointment request is captured without repeating promotion', () => {
  const conversation = state()
  applyMessageAnalysis(conversation, analysis({ customerWeightGoal: 'Lose weight', customerStateCode: 'FL' }))
  const plan = applyMessageAnalysis(conversation, analysis({
    appointmentIntent: 'requests_alternative',
    appointmentPreference: 'Neither works; another day',
  }))
  assert.equal(plan.acknowledgeAppointmentPreference, true)
  assert.equal(conversation.selectedAppointmentPreference, 'Neither works; another day')
  assert.equal(plan.includePromotionIntro, false)
})

test('scenario 9: all one-time messages remain one-time', () => {
  const conversation = state()
  const first = applyMessageAnalysis(conversation, analysis({ customerWeightGoal: 'Lose weight', customerStateCode: 'FL' }))
  const second = applyMessageAnalysis(conversation, analysis({ questionTopics: ['consultation', 'pricing'] }))
  assert.equal(conversation.introductionSent, true)
  assert.equal(first.acknowledgeGoal, true)
  assert.equal(first.includeConsultationIntro, true)
  assert.equal(first.includePromotionIntro, true)
  assert.equal(second.acknowledgeGoal, false)
  assert.equal(second.includeConsultationIntro, false)
  assert.equal(second.includePromotionIntro, false)
})

test('ambiguous state recognition is never stored as confirmed and requests clarification', () => {
  const conversation = state()
  const plan = applyMessageAnalysis(conversation, analysis({
    detectedLanguage: 'pt',
    customerWeightGoal: 'Perder peso',
    stateRecognition: 'ambiguous',
    stateCandidates: ['NC', 'SC'],
  }))
  assert.equal(conversation.customerState, null)
  assert.equal(conversation.preferredLanguage, 'pt')
  assert.equal(plan.clarifyState, true)
  assert.equal(plan.nextQuestion, 'state')
})
