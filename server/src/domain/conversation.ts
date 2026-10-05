export const conversationStages = [
  'weight_goal',
  'state',
  'consultation',
  'appointment',
  'booking_details',
  'complete',
] as const

export type ConversationStage = (typeof conversationStages)[number]
export type ConversationStatus = 'active' | 'needs_staff' | 'completed'
export type PreferredLanguage = 'en' | 'es' | 'pt' | 'other'

export type ChatMessage = {
  role: 'customer' | 'maria'
  content: string
  createdAt: string
}

export type ConversationState = {
  id: string
  currentStage: ConversationStage
  customerWeightGoal: string | null
  customerState: string | null
  customerCity?: string | null
  stateEligibility: 'serviceable' | 'unserviceable' | 'unknown' | null
  preferredLanguage: PreferredLanguage
  introductionSent: boolean
  empathyResponseSent: boolean
  consultationIntroSent: boolean
  promotionIntroSent: boolean
  startingPriceSent: boolean
  paymentOptionsSent: boolean
  appointmentOfferSent: boolean
  appointmentStageActive: boolean
  alternativeFlowActive: boolean
  supplementAlternativeSent: boolean
  selectedAppointmentPreference: string | null
  customerTimezone?: string | null
  offeredAppointmentSlots?: AppointmentSlot[]
  selectedAppointmentSlot?: AppointmentSlot | null
  customerPhone?: string | null
  customerFullName?: string | null
  conversationStatus: ConversationStatus
  lastAskedQuestion: 'weight_goal' | 'state' | 'appointment' | 'phone' | 'full_name' | null
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export type AppointmentSlot = {
  startTime: string
  endTime: string
  timezone: string
  timezoneLabel: string
  hubspotUserId: number
  meetingLinkSlug: string
}

export type QuestionTopic =
  | 'pricing'
  | 'treatments'
  | 'payment_methods'
  | 'delivery'
  | 'consultation'
  | 'medical_suitability'
  | 'other'

export type MessageAnalysis = {
  detectedLanguage: PreferredLanguage
  customerWeightGoal: string | null
  customerStateCode: string | null
  customerCity?: string | null
  questionTopics: QuestionTopic[]
  appointmentIntent:
    | 'none'
    | 'accepts_offer'
    | 'requests_alternative'
    | 'prefers_morning'
    | 'prefers_afternoon'
    | 'specific_time'
  appointmentPreference: string | null
  stateRecognition?: 'exact' | 'alias' | 'fuzzy' | 'ambiguous' | 'none' | 'city_exact' | 'city_alias' | 'city_fuzzy' | 'inconsistent'
  stateCandidates?: string[]
}

export type ResponsePlan = {
  answerTopics: QuestionTopic[]
  acknowledgeGoal: boolean
  includeConsultationIntro: boolean
  includePromotionIntro: boolean
  includeStartingPrice: boolean
  includePaymentOptions: boolean
  acknowledgeAppointmentPreference: boolean
  stateEligibility: ConversationState['stateEligibility']
  nextQuestion: ConversationState['lastAskedQuestion']
  clarifyState: boolean
  includeSupplementAlternative: boolean
  appointmentSlots?: AppointmentSlot[]
  selectedAppointmentSlot?: AppointmentSlot | null
  bookingDetailRequest?: 'phone' | 'full_name' | null
  bookingDetailsComplete?: boolean
  bookingConfirmation?: string | null
  bookingFailed?: boolean
  appointmentAvailabilityFailed?: boolean
}
