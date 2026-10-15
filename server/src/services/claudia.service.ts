import { env } from '../config/env.js'
import type { ConversationState, MessageAnalysis } from '../domain/conversation.js'
import type { KnowledgeContext } from '../knowledge/knowledge.types.js'
import { openai } from '../lib/openai.js'

export function claudiaIntroductionForLanguage(language: 'en' | 'es' | 'pt') {
  if (language === 'es') return '¡Hola! Soy Claudia de Dharma Clinic 🌿 Ofrecemos programas personalizados con Semaglutida y Tirzepatida, con envío a 43 estados de EE. UU.'
  if (language === 'pt') return 'Olá! Sou Claudia da Dharma Clinic 🌿 Oferecemos programas personalizados com Semaglutida e Tirzepatida, com entrega em 43 estados dos EUA.'
  return "Hello! I'm Claudia from Dharma Clinic 🌿 We offer personalized Semaglutide and Tirzepatide programs with delivery to 43 U.S. states."
}

export function claudiaQuestionTransition(language: 'en' | 'es' | 'pt') {
  if (language === 'es') return 'Para responder a tu pregunta:'
  if (language === 'pt') return 'Para responder à sua pergunta:'
  return 'To answer your question:'
}

export function claudiaGreetingForLanguage(language: 'en' | 'es' | 'pt') {
  return `${claudiaIntroductionForLanguage(language)}\n\n${askWeightGoal(language)}`
}

export function customerRequestsSalesLink(message: string) {
  return /\b(?:link|buy|purchase|order|checkout|comprar|pedido|enlace|liga[cç][aã]o)\b/iu.test(message)
}

export function claudiaOffer(language: ConversationState['preferredLanguage'], salesUrl: string | null) {
  const link = salesUrl ? `\n\n${salesUrl}` : ''
  const postPurchase = language === 'es'
    ? 'Después de comprar, un representante de Dharma te llamará, te explicará el proceso y te acompañará durante el programa.'
    : language === 'pt'
      ? 'Depois da compra, um representante da Dharma ligará, explicará o processo e acompanhará você durante o programa.'
      : 'After purchase, a Dharma representative will call, explain the process, and support you throughout the program.'
  if (language === 'es') return `🌟 El Programa VIP Dharma incluye apoyo 1:1, supervisión médica y guías de nutrición y ejercicio. Con aprobación médica, el medicamento se envía desde una farmacia 503(a) de EE. UU. en 3–5 días hábiles.

Semaglutida desde $199 y Tirzepatida desde $299. ${postPurchase}

${salesUrl ? '✨ Compra aquí:' : ''}${link}`
  if (language === 'pt') return `🌟 O Programa VIP Dharma inclui suporte individual, supervisão médica e guias de nutrição e exercícios. Com aprovação médica, o medicamento é enviado por uma farmácia 503(a) dos EUA em 3–5 dias úteis.

Semaglutida a partir de US$ 199 e Tirzepatida a partir de US$ 299. ${postPurchase}

${salesUrl ? '✨ Compre aqui:' : ''}${link}`
  return `🌟 The VIP Dharma Program includes 1:1 support, medical supervision, and nutrition and exercise guides. With medical approval, medication ships from a U.S. 503(a) pharmacy in 3–5 business days.

Semaglutide starts at $199 and Tirzepatide at $299. ${postPurchase}

${salesUrl ? '✨ Purchase here:' : ''}${link}`
}

function askWeightGoal(language: ConversationState['preferredLanguage']) {
  if (language === 'es') return '¿Cuál es tu principal objetivo de peso en este momento?'
  if (language === 'pt') return 'Qual é o seu principal objetivo de peso neste momento?'
  return 'What is your main weight goal right now?'
}

export function removeQuestions(text: string) {
  return text
    .split(/\n+/u)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/u))
    .filter((part) => !/[?¿]/u.test(part))
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function readyClosing(language: ConversationState['preferredLanguage']) {
  if (language === 'es') return 'Estoy aquí para ayudarte cuando estés listo. 💚'
  if (language === 'pt') return 'Estou aqui para ajudar quando você estiver pronto. 💚'
  return 'I’m here to help when you’re ready. 💚'
}

export async function generateClaudiaReply(
  customerMessage: string,
  state: ConversationState,
  analysis: MessageAnalysis,
  knowledge: KnowledgeContext,
  options: { includeOffer: boolean; includeLinkOnly: boolean; salesUrl: string | null },
) {
  let answer = ''
  if (analysis.questionTopics.length > 0 && !customerRequestsSalesLink(customerMessage)) {
    const response = await openai.responses.create({
      model: env.OPENAI_MODEL,
      store: false,
      max_output_tokens: 180,
      instructions: `You are Claudia from Dharma Nutrition Clinic: an empathetic, energetic, highly conversational sales concierge. Reply in ${state.preferredLanguage === 'es' ? 'Spanish' : state.preferredLanguage === 'pt' ? 'Portuguese' : 'English'}.
Use recentConversation to understand short replies, references, and facts already discussed. Answer only the customer's current question using structuredKnowledge and behavioralGuidance, applying complianceRules first. Write one short paragraph, normally 2 to 4 direct sentences, with at most 1 relevant emoji. Never ask a question; the application controls all questions. Do not repeat the customer's goal, the full VIP program, prices, shipping details, pharmacy details, or facts already communicated unless the customer specifically asks about them. Be encouraging and persuasive without pressure, guarantees, or exaggerated claims.
Never diagnose, prescribe, determine eligibility, promise results, or invent facts. If approved knowledge does not answer the question, say clinic staff must confirm it. Claudia's job is to answer the customer's questions, clearly explain what the treatment and program involve, and help the customer purchase through checkout when ready. Never offer or schedule an appointment, consultation, analysis call, or booking before purchase. Explain when relevant that after purchase a Dharma customer representative will call, explain the process, provide the nutrition and exercise guides, and take care of the customer throughout the program. Do not request a state or mention internal systems. Never say that you cannot share links, cannot send a link, or that another app or person must provide a link. Do not include a purchase URL in your generated answer or repeat the complete VIP program pitch; the application appends the real configured link when appropriate. Do not ask for the weight goal when it is already present in knownWeightGoal.`,
      input: JSON.stringify({
        customerMessage,
        knownWeightGoal: state.customerWeightGoal,
        recentConversation: state.messages.slice(-12).map(({ role, content }) => ({ role, content })),
        structuredKnowledge: knowledge.structured.map(({ sourceType, content }) => ({ sourceType, content })),
        behavioralGuidance: knowledge.guidance.map(({ sourceType, content }) => ({ sourceType, content })),
        complianceRules: knowledge.compliance.map(({ content }) => content),
        approvedProgramFacts: {
          role: 'Claudia answers customer questions, clearly explains the treatment and program, and helps the customer purchase through the configured checkout link when ready. She never offers, schedules, or implies a consultation, analysis call, appointment, or booking before purchase.',
          postPurchaseProcess: 'After the customer purchases, a Dharma customer representative will call them, explain the complete process, provide the nutrition and exercise guides, and take care of them throughout the program.',
          oneToOneSupport: 'After purchase, a Dharma customer representative provides personalized support; do not describe this as a pre-purchase consultation or appointment.',
          includedSupport: ['post-purchase personalized support', 'medical supervision', 'nutrition guide', 'exercise guide'],
          fulfillment: 'If medically approved, orders ship in 3-5 business days from a USA-based 503(a) pharmacy.',
          startingPrices: { semaglutide: '$199', tirzepatide: '$299' },
        },
      }),
    })
    answer = removeQuestions(response.output_text)
  }

  if (options.includeOffer) {
    const acknowledgment = state.preferredLanguage === 'es'
      ? '💚 Podemos ayudarte a trabajar hacia tu objetivo. Algunos pacientes han reportado perder más de 60 lb; los resultados individuales varían y se requiere aprobación médica.'
      : state.preferredLanguage === 'pt'
        ? '💚 Podemos ajudar você a trabalhar em direção à sua meta. Alguns pacientes relataram perder mais de 60 lb; os resultados individuais variam e a aprovação médica é obrigatória.'
        : '💚 We can help you work toward your goal. Some patients have reported losing 60+ lbs; individual results vary, and medical approval is required.'
    return [answer, acknowledgment, claudiaOffer(state.preferredLanguage, options.salesUrl)].filter(Boolean).join('\n\n')
  }
  if (options.includeLinkOnly && options.salesUrl) {
    return [answer, options.salesUrl].filter(Boolean).join('\n\n')
  }
  if (!state.customerWeightGoal) return [answer, askWeightGoal(state.preferredLanguage)].filter(Boolean).join('\n\n')
  return answer || readyClosing(state.preferredLanguage)
}
