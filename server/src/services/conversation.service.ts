import { randomUUID } from 'node:crypto'
import type { ConversationState, MessageAnalysis } from '../domain/conversation.js'
import type { ConversationRepository } from '../repositories/conversation.repository.js'
import { conversationRepository } from '../repositories/conversation.repository.js'
import { applyMessageAnalysis } from './conversation-engine.js'
import { analyzeCustomerMessage, generateMariaReply } from './maria.service.js'
import { retrieveKnowledge } from '../knowledge/knowledge.retrieval.js'
import { findAppointmentAvailability } from '../appointments/availability.service.js'
import type { AppointmentSlot } from '../domain/conversation.js'
import { bookAppointment } from '../appointments/booking.service.js'

function selectedOfferedSlot(message: string, analysis: MessageAnalysis, slots: AppointmentSlot[]) {
  const bookableSlots = slots.filter((slot) => appointmentSlotIsBookable(slot))
  if (!['accepts_offer', 'specific_time'].includes(analysis.appointmentIntent) || bookableSlots.length === 0) return null
  const normalized = message.toLowerCase()
  if (/^\s*(?:a|#?1)\s*$/.test(normalized) || /\b(option|choice|number|slot|letter)\s*(?:a|#?1)\b/.test(normalized) || /\b(first|1st|one|earlier|primero|primeiro|la primera|a primeira)\b/.test(normalized)) return bookableSlots[0] ?? null
  if (/^\s*(?:b|#?2)\s*$/.test(normalized) || /\b(option|choice|number|slot|letter)\s*(?:b|#?2)\b/.test(normalized) || /\b(second|2nd|two|later|segundo|la segunda|a segunda)\b/.test(normalized)) return bookableSlots[1] ?? null
  const period = /\b(morning|mañana|manhã)\b/.test(normalized)
    ? 'morning'
    : /\b(afternoon|tarde)\b/.test(normalized)
      ? 'afternoon'
      : null
  if (period) {
    const matchingSlots = bookableSlots.filter((slot) => {
      const hour = Number(new Intl.DateTimeFormat('en-US', {
        timeZone: slot.timezone,
        hour: 'numeric',
        hour12: false,
      }).format(Date.parse(slot.startTime))) % 24
      return period === 'morning' ? hour < 12 : hour >= 12
    })
    if (matchingSlots.length === 1) return matchingSlots[0]
  }
  const time = normalized.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/)
  if (time) {
    let requestedHour = Number(time[1]) % 12
    if (time[3] === 'pm') requestedHour += 12
    const requestedMinute = Number(time[2] ?? 0)
    const matchingSlots = bookableSlots.filter((slot) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: slot.timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(Date.parse(slot.startTime))
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
      return Number(values.hour) % 24 === requestedHour && Number(values.minute) === requestedMinute
    })
    if (matchingSlots.length === 1) return matchingSlots[0]
  }
  if (bookableSlots.length === 1 && /\b(yes|yeah|yep|confirm|correct|si|sí|sim|ok|okay)\b/.test(normalized)) return bookableSlots[0]
  return null
}

export function requestsAnotherAppointmentDate(message: string, analysis: MessageAnalysis) {
  if (analysis.appointmentIntent === 'requests_alternative') return true
  return /\b(?:another|different|other|next)\s+(?:date|day)\b|\b(?:otra|otro|diferente|siguiente)\s+(?:fecha|d[ií]a)\b|\b(?:outra|outro|diferente|pr[oó]xim[oa])\s+(?:data|dia)\b/iu.test(message)
}

function offeredLocalDates(slots: AppointmentSlot[]) {
  return [...new Set(slots.map((slot) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: slot.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(Date.parse(slot.startTime))
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
  }))]
}

export function appointmentSlotIsBookable(slot: AppointmentSlot, now = Date.now()) {
  return Date.parse(slot.startTime) > now
}

function normalizeUsPhone(message: string) {
  const digits = message.replace(/\D/g, '')
  if (digits.length === 10) return `1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return digits
  return null
}

function extractFullName(message: string) {
  const name = message.trim().replace(/\s+/g, ' ')
  if (name.length < 3 || name.length > 100 || !/^\p{L}[\p{L}'’. -]*\s+\p{L}[\p{L}'’. -]*$/u.test(name)) return null
  return name
}

export class ConversationNotFoundError extends Error {}
export class CustomerMessageNotUnderstoodError extends Error {}

export const initialGreeting = `Hello! I'm Maria from Dharma Clinic 🌿

We specialize in personalized weight loss with Semaglutide and Tirzepatide with direct shipping to your home in 43 U.S. states. 📦✨

To better orient yourself, what is your main weight goal right now?`

export function initialGreetingForLanguage(language: 'en' | 'es' | 'pt') {
  if (language === 'es') return `¡Hola! Soy Maria de Dharma Clinic 🌿

Nos especializamos en pérdida de peso personalizada con Semaglutida y Tirzepatida, con envío directo a tu hogar en 43 estados de EE. UU. 📦✨

Para orientarte mejor, ¿cuál es tu principal objetivo de peso en este momento?`
  if (language === 'pt') return `Olá! Sou Maria da Dharma Clinic 🌿

Somos especializados em perda de peso personalizada com Semaglutida e Tirzepatida, com entrega direta na sua casa em 43 estados dos EUA. 📦✨

Para te orientar melhor, qual é o seu principal objetivo de peso neste momento?`
  return initialGreeting
}

type Dependencies = {
  repository: ConversationRepository
  analyze: typeof analyzeCustomerMessage
  generate: typeof generateMariaReply
  retrieve: typeof retrieveKnowledge
  findAvailability?: (input: {
    stateCode: string
    city?: string | null
    preference?: string | null
    excludeLocalDates?: string[]
  }) => Promise<AppointmentSlot[]>
  bookAppointment?: typeof bookAppointment
}

export class ConversationService {
  constructor(private readonly dependencies: Dependencies) {}

  createConversation(preferredLanguage: 'en' | 'es' | 'pt' = 'es') {
    const now = new Date().toISOString()
    const state: ConversationState = {
      id: randomUUID(),
      currentStage: 'weight_goal',
      customerWeightGoal: null,
      customerState: null,
      customerCity: null,
      stateEligibility: null,
      preferredLanguage,
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
      customerTimezone: null,
      offeredAppointmentSlots: [],
      selectedAppointmentSlot: null,
      customerPhone: null,
      customerFullName: null,
      conversationStatus: 'active',
      lastAskedQuestion: 'weight_goal',
      messages: [{ role: 'maria', content: initialGreetingForLanguage(preferredLanguage), createdAt: now }],
      createdAt: now,
      updatedAt: now,
    }
    this.dependencies.repository.create(state)
    return state
  }

  async processMessage(conversationId: string, message: string) {
    const state = this.dependencies.repository.findById(conversationId)
    if (!state) throw new ConversationNotFoundError('Conversation not found')

    if (state.selectedAppointmentSlot && !appointmentSlotIsBookable(state.selectedAppointmentSlot)) {
      state.selectedAppointmentSlot = null
      state.selectedAppointmentPreference = null
      state.offeredAppointmentSlots = []
      state.currentStage = 'appointment'
      state.appointmentStageActive = true
      state.lastAskedQuestion = 'appointment'
    }

    const previouslyOfferedSlots = [...(state.offeredAppointmentSlots ?? [])]
    const analysis = await this.dependencies.analyze(message, state)
    if (analysis.isUnderstandable === false) {
      throw new CustomerMessageNotUnderstoodError('Customer message could not be understood')
    }
    const pendingBookingDetail = state.currentStage === 'booking_details' ? state.lastAskedQuestion : null
    const chosenSlot = selectedOfferedSlot(message, analysis, state.offeredAppointmentSlots ?? [])
    const flowBeforeAnalysis = {
      consultationIntroSent: state.consultationIntroSent,
      promotionIntroSent: state.promotionIntroSent,
      startingPriceSent: state.startingPriceSent,
      paymentOptionsSent: state.paymentOptionsSent,
      appointmentOfferSent: state.appointmentOfferSent,
      appointmentStageActive: state.appointmentStageActive,
      alternativeFlowActive: state.alternativeFlowActive,
      supplementAlternativeSent: state.supplementAlternativeSent,
    }
    const plan = applyMessageAnalysis(state, analysis)
    const knowledge = await this.dependencies.retrieve({ message, state, analysis })
    const shipping = knowledge.structured.find((entry) => entry.sourceType === 'shipping_rules' && entry.attributes?.stateCode === state.customerState)
    if (plan.clarifyState) {
      state.currentStage = 'state'
      state.lastAskedQuestion = 'state'
      plan.nextQuestion = 'state'
      plan.includeConsultationIntro = false
      plan.includePromotionIntro = false
      plan.includeStartingPrice = false
      plan.includePaymentOptions = false
      plan.includeSupplementAlternative = false
      plan.acknowledgeAppointmentPreference = false
    } else if (shipping) {
      state.stateEligibility = shipping.attributes?.isServiceable === true ? 'serviceable' : 'unserviceable'
      plan.stateEligibility = state.stateEligibility
      if (state.stateEligibility === 'serviceable') {
        state.alternativeFlowActive = false
        state.supplementAlternativeSent = false
        state.conversationStatus = 'active'
        if (!chosenSlot && !pendingBookingDetail && state.customerWeightGoal) {
          const hasConsultation = knowledge.structured.some((entry) => entry.sourceType === 'clinic_information' && entry.content.toLowerCase().includes('consult'))
          const hasPromotion = knowledge.structured.some((entry) => entry.sourceType === 'promotions')
          const hasStartingPrice = knowledge.structured.some((entry) => entry.sourceType === 'pricing_packages')
          const hasPaymentOptions = knowledge.structured.some((entry) => entry.sourceType === 'payment_methods')
          state.currentStage = 'appointment'
          state.appointmentStageActive = true
          plan.includeConsultationIntro = !flowBeforeAnalysis.consultationIntroSent && hasConsultation
          plan.includePromotionIntro = !flowBeforeAnalysis.promotionIntroSent && hasPromotion
          plan.includeStartingPrice = !flowBeforeAnalysis.startingPriceSent && hasStartingPrice
          plan.includePaymentOptions = !flowBeforeAnalysis.paymentOptionsSent && hasPaymentOptions
          state.consultationIntroSent = flowBeforeAnalysis.consultationIntroSent || plan.includeConsultationIntro
          state.promotionIntroSent = flowBeforeAnalysis.promotionIntroSent || plan.includePromotionIntro
          state.startingPriceSent = flowBeforeAnalysis.startingPriceSent || plan.includeStartingPrice
          state.paymentOptionsSent = flowBeforeAnalysis.paymentOptionsSent || plan.includePaymentOptions
          state.appointmentOfferSent = true
          state.lastAskedQuestion = 'appointment'
          plan.nextQuestion = 'appointment'
        } else if (!chosenSlot && !pendingBookingDetail) {
          state.currentStage = 'weight_goal'
          state.appointmentStageActive = false
          plan.includeConsultationIntro = false
          plan.includePromotionIntro = false
          plan.includeStartingPrice = false
          plan.includePaymentOptions = false
          state.lastAskedQuestion = 'weight_goal'
          plan.nextQuestion = 'weight_goal'
        }
      } else {
        state.currentStage = 'state'
        state.conversationStatus = 'active'
        state.alternativeFlowActive = true
        plan.includeSupplementAlternative = !flowBeforeAnalysis.supplementAlternativeSent
        state.supplementAlternativeSent = true
        state.consultationIntroSent = flowBeforeAnalysis.consultationIntroSent
        state.promotionIntroSent = flowBeforeAnalysis.promotionIntroSent
        state.startingPriceSent = flowBeforeAnalysis.startingPriceSent
        state.paymentOptionsSent = flowBeforeAnalysis.paymentOptionsSent
        state.appointmentOfferSent = flowBeforeAnalysis.appointmentOfferSent
        state.appointmentStageActive = false
        state.appointmentOfferSent = false
        plan.acknowledgeAppointmentPreference = false
        plan.includeConsultationIntro = false
        plan.includePromotionIntro = false
        plan.includeStartingPrice = false
        plan.includePaymentOptions = false
        state.lastAskedQuestion = null
        plan.nextQuestion = null
      }
    } else if (state.customerState && (analysis.customerStateCode || analysis.questionTopics.includes('delivery'))) {
      state.stateEligibility = 'unknown'
      state.alternativeFlowActive = false
      state.supplementAlternativeSent = false
      plan.stateEligibility = 'unknown'
      state.currentStage = 'state'
      state.conversationStatus = 'needs_staff'
      state.consultationIntroSent = flowBeforeAnalysis.consultationIntroSent
      state.promotionIntroSent = flowBeforeAnalysis.promotionIntroSent
      state.startingPriceSent = flowBeforeAnalysis.startingPriceSent
      state.paymentOptionsSent = flowBeforeAnalysis.paymentOptionsSent
      state.appointmentOfferSent = flowBeforeAnalysis.appointmentOfferSent
      state.appointmentStageActive = flowBeforeAnalysis.appointmentStageActive
      plan.includeConsultationIntro = false
      plan.includePromotionIntro = false
      plan.includeStartingPrice = false
      plan.includePaymentOptions = false
      state.lastAskedQuestion = null
      plan.nextQuestion = null
    }
    if (chosenSlot) {
      state.selectedAppointmentSlot = chosenSlot
      state.selectedAppointmentPreference = chosenSlot.startTime
      state.currentStage = 'booking_details'
      state.appointmentStageActive = false
      state.lastAskedQuestion = 'phone'
      state.conversationStatus = 'active'
      plan.selectedAppointmentSlot = chosenSlot
      plan.appointmentSlots = []
      plan.acknowledgeAppointmentPreference = true
      plan.nextQuestion = 'phone'
      plan.bookingDetailRequest = 'phone'
    } else if (pendingBookingDetail === 'phone') {
      const phone = normalizeUsPhone(message)
      if (phone) {
        state.customerPhone = phone
        state.lastAskedQuestion = 'full_name'
        plan.nextQuestion = 'full_name'
        plan.bookingDetailRequest = 'full_name'
      } else {
        state.lastAskedQuestion = 'phone'
        plan.nextQuestion = 'phone'
        plan.bookingDetailRequest = 'phone'
      }
      plan.appointmentSlots = []
    } else if (pendingBookingDetail === 'full_name') {
      const fullName = extractFullName(message)
      if (fullName) {
        state.customerFullName = fullName
        try {
          if (!this.dependencies.bookAppointment) throw new Error('Booking integration is unavailable')
          const result = await this.dependencies.bookAppointment({
            slot: state.selectedAppointmentSlot!, phone: state.customerPhone!, fullName,
            language: state.preferredLanguage,
          })
          state.currentStage = 'complete'
          state.lastAskedQuestion = null
          state.conversationStatus = 'completed'
          plan.nextQuestion = null
          plan.bookingDetailRequest = null
          plan.bookingDetailsComplete = true
          plan.bookingConfirmation = result.confirmation
          plan.bookingFinancingMessage = result.financing
        } catch {
          state.currentStage = 'booking_details'
          state.lastAskedQuestion = null
          state.conversationStatus = 'needs_staff'
          plan.nextQuestion = null
          plan.bookingDetailRequest = null
          plan.bookingFailed = true
        }
      } else {
        state.lastAskedQuestion = 'full_name'
        plan.nextQuestion = 'full_name'
        plan.bookingDetailRequest = 'full_name'
      }
      plan.appointmentSlots = []
    }
    if (
      state.currentStage === 'appointment'
      && state.stateEligibility === 'serviceable'
      && this.dependencies.findAvailability
    ) {
      try {
        const slots = await this.dependencies.findAvailability({
          stateCode: state.customerState!,
          city: state.customerCity,
          preference: state.selectedAppointmentPreference,
          excludeLocalDates: requestsAnotherAppointmentDate(message, analysis)
            ? offeredLocalDates(previouslyOfferedSlots)
            : undefined,
        })
        state.offeredAppointmentSlots = slots
        state.customerTimezone = slots[0]?.timezone ?? state.customerTimezone
        plan.appointmentSlots = slots
        plan.appointmentAvailabilityFailed = slots.length === 0
        if (slots.length) state.conversationStatus = 'active'
      } catch {
        state.offeredAppointmentSlots = []
        plan.appointmentSlots = []
        plan.appointmentAvailabilityFailed = true
        state.conversationStatus = 'needs_staff'
      }
    }
    const reply = await this.dependencies.generate(message, state, plan, knowledge)
    const now = new Date().toISOString()
    state.messages.push(
      { role: 'customer', content: message, createdAt: now },
      { role: 'maria', content: reply, createdAt: now },
    )
    state.messages = state.messages.slice(-20)
    this.dependencies.repository.save(state)
    return { reply, state: publicState(state), plan }
  }
}

export function publicState(state: ConversationState) {
  return {
    id: state.id,
    currentStage: state.currentStage,
    customerWeightGoal: state.customerWeightGoal,
    customerState: state.customerState,
    customerCity: state.customerCity ?? null,
    stateEligibility: state.stateEligibility,
    preferredLanguage: state.preferredLanguage,
    introductionSent: state.introductionSent,
    empathyResponseSent: state.empathyResponseSent,
    consultationIntroSent: state.consultationIntroSent,
    promotionIntroSent: state.promotionIntroSent,
    startingPriceSent: state.startingPriceSent,
    paymentOptionsSent: state.paymentOptionsSent,
    appointmentOfferSent: state.appointmentOfferSent,
    appointmentStageActive: state.appointmentStageActive,
    alternativeFlowActive: state.alternativeFlowActive,
    supplementAlternativeSent: state.supplementAlternativeSent,
    selectedAppointmentPreference: state.selectedAppointmentPreference,
    customerTimezone: state.customerTimezone ?? null,
    offeredAppointmentSlots: state.offeredAppointmentSlots ?? [],
    selectedAppointmentSlot: state.selectedAppointmentSlot ?? null,
    customerPhone: state.customerPhone ?? null,
    customerFullName: state.customerFullName ?? null,
    conversationStatus: state.conversationStatus,
    lastAskedQuestion: state.lastAskedQuestion,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  }
}

export const conversationService = new ConversationService({
  repository: conversationRepository,
  analyze: analyzeCustomerMessage,
  generate: generateMariaReply,
  retrieve: retrieveKnowledge,
  findAvailability: findAppointmentAvailability,
  bookAppointment,
})

export function analysis(overrides: Partial<MessageAnalysis> = {}): MessageAnalysis {
  return {
    detectedLanguage: 'en',
    customerWeightGoal: null,
    customerStateCode: null,
    questionTopics: [],
    appointmentIntent: 'none',
    appointmentPreference: null,
    stateRecognition: 'none',
    stateCandidates: [],
    ...overrides,
  }
}
