import { getStateEligibility } from '../config/clinic.js'
import type {
  ConversationState,
  MessageAnalysis,
  ResponsePlan,
} from '../domain/conversation.js'

export function applyMessageAnalysis(
  state: ConversationState,
  analysis: MessageAnalysis,
): ResponsePlan {
  const hadGoal = Boolean(state.customerWeightGoal)

  if (analysis.detectedLanguage !== 'other') {
    state.preferredLanguage = analysis.detectedLanguage
  }

  if (analysis.customerWeightGoal) {
    state.customerWeightGoal = analysis.customerWeightGoal
  }

  if (analysis.customerStateCode) {
    state.customerState = analysis.customerStateCode
    state.stateEligibility = getStateEligibility(analysis.customerStateCode)
  }

  if (analysis.customerCity) state.customerCity = analysis.customerCity

  if (analysis.appointmentPreference) {
    state.selectedAppointmentPreference = analysis.appointmentPreference
  }

  const acknowledgeGoal = !hadGoal && Boolean(state.customerWeightGoal) && !state.empathyResponseSent
  if (acknowledgeGoal) state.empathyResponseSent = true

  let includeConsultationIntro = false
  let includePromotionIntro = false

  if (state.currentStage === 'booking_details' && state.selectedAppointmentSlot) {
    state.appointmentStageActive = false
    state.lastAskedQuestion ??= 'phone'
  } else if (state.customerWeightGoal && !state.customerState) {
    state.currentStage = 'state'
    state.lastAskedQuestion = 'state'
  } else if (!state.customerWeightGoal) {
    state.currentStage = 'weight_goal'
    state.lastAskedQuestion = 'weight_goal'
  } else if (state.stateEligibility === 'serviceable') {
    state.currentStage = 'appointment'
    state.appointmentStageActive = true
    includeConsultationIntro = !state.consultationIntroSent
    includePromotionIntro = !state.promotionIntroSent
    state.consultationIntroSent = true
    state.promotionIntroSent = true
    state.appointmentOfferSent = true
    state.lastAskedQuestion = 'appointment'
  } else {
    state.currentStage = 'state'
    state.conversationStatus = 'needs_staff'
    state.lastAskedQuestion = null
  }

  const acknowledgeAppointmentPreference = analysis.appointmentIntent !== 'none'
  if (acknowledgeAppointmentPreference) {
    state.appointmentStageActive = true
    state.conversationStatus = 'needs_staff'
  }

  state.updatedAt = new Date().toISOString()

  return {
    answerTopics: [...new Set(analysis.questionTopics)],
    acknowledgeGoal,
    includeConsultationIntro,
    includePromotionIntro,
    includeStartingPrice: false,
    includePaymentOptions: false,
    acknowledgeAppointmentPreference,
    stateEligibility: state.stateEligibility,
    nextQuestion: state.lastAskedQuestion,
    clarifyState: analysis.stateRecognition === 'ambiguous' || analysis.stateRecognition === 'inconsistent',
    includeSupplementAlternative: false,
  }
}
