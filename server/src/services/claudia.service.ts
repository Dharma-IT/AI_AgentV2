import { env } from '../config/env.js'
import type { ConversationState, MessageAnalysis } from '../domain/conversation.js'
import type { KnowledgeContext } from '../knowledge/knowledge.types.js'
import { openai } from '../lib/openai.js'

export function claudiaIntroductionForLanguage(language: 'en' | 'es' | 'pt') {
  if (language === 'es') return `¡Hola! Soy Claudia de Dharma Clinic 🌿

Nos especializamos en pérdida de peso personalizada con Semaglutida y Tirzepatida, con envío directo a tu hogar en 43 estados de EE. UU. 📦✨`
  if (language === 'pt') return `Olá! Sou Claudia da Dharma Clinic 🌿

Somos especializados em perda de peso personalizada com Semaglutida e Tirzepatida, com entrega direta na sua casa em 43 estados dos EUA. 📦✨`
  return `Hello! I'm Claudia from Dharma Clinic 🌿

We specialize in personalized weight loss with Semaglutide and Tirzepatide, with direct shipping to your home in 43 U.S. states. 📦✨`
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
  const unavailable = salesUrl
    ? ''
    : language === 'es' ? 'Nuestro equipo debe confirmar el enlace antes de compartirlo.' : language === 'pt' ? 'Nossa equipe precisa confirmar o link antes de compartilhá-lo.' : 'Our team needs to confirm the link before sharing it.'
  if (language === 'es') return `🌟 Nuestro Programa VIP Dharma incluye:

• 🤝 Atención 1:1 con nuestro equipo de soporte
• 💚 Apoyo personalizado
• 🩺 Supervisión médica durante todo el programa
• 🥗 Guía nutricional
• 💪 Guía de ejercicios
• 📦 Medicamentos enviados desde una farmacia 503(a) con sede en EE. UU.
• 🚚 Si recibes aprobación, tu pedido se envía en 3–5 días hábiles

Semaglutida desde $199 y Tirzepatida desde $299. La aprobación clínica es obligatoria.

${salesUrl ? '✨ Puedes dar el siguiente paso aquí:' : `💬 ${unavailable}`}${link}`
  if (language === 'pt') return `🌟 Nosso Programa VIP Dharma inclui:

• 🤝 Atendimento individual com nossa equipe de suporte
• 💚 Suporte personalizado
• 🩺 Supervisão médica durante todo o programa
• 🥗 Guia nutricional
• 💪 Guia de exercícios
• 📦 Medicamentos enviados por uma farmácia 503(a) sediada nos EUA
• 🚚 Se houver aprovação, seu pedido será enviado em 3–5 dias úteis

Semaglutida a partir de US$ 199 e Tirzepatida a partir de US$ 299. A aprovação clínica é obrigatória.

${salesUrl ? '✨ Você pode dar o próximo passo aqui:' : `💬 ${unavailable}`}${link}`
  return `🌟 Our VIP Dharma Program includes:

• 🤝 1:1 support from our customer support team
• 💚 Personalized support
• 🩺 Medical supervision throughout the full program
• 🥗 Nutritional guide
• 💪 Exercise guide
• 📦 Medication shipped from a USA-based 503(a) pharmacy
• 🚚 If approved, your order ships within 3–5 business days

Semaglutide starts at $199 and Tirzepatide starts at $299. Clinical approval is required.

${salesUrl ? '✨ You can take the next step here:' : `💬 ${unavailable}`}${link}`
}

function askWeightGoal(language: ConversationState['preferredLanguage']) {
  if (language === 'es') return '¿Cuál es tu principal objetivo de peso en este momento?'
  if (language === 'pt') return 'Qual é o seu principal objetivo de peso neste momento?'
  return 'What is your main weight goal right now?'
}

export async function generateClaudiaReply(
  customerMessage: string,
  state: ConversationState,
  analysis: MessageAnalysis,
  knowledge: KnowledgeContext,
  options: { includeOffer: boolean; includeLinkOnly: boolean; salesUrl: string | null },
) {
  let answer = ''
  if (analysis.questionTopics.length > 0) {
    const response = await openai.responses.create({
      model: env.OPENAI_MODEL,
      store: false,
      instructions: `You are Claudia from Dharma Nutrition Clinic: an empathetic, energetic, highly conversational sales concierge. Reply in ${state.preferredLanguage === 'es' ? 'Spanish' : state.preferredLanguage === 'pt' ? 'Portuguese' : 'English'}.
Answer the customer's question first using only structuredKnowledge and behavioralGuidance, applying complianceRules first. Connect the answer naturally to the customer's goal and explain the practical value of the program rather than sounding like a reference article. Use 3 to 6 friendly, relevant emojis throughout the response. Be encouraging and persuasive without pressure, guarantees, or exaggerated claims.
Never diagnose, prescribe, determine eligibility, promise results, or invent facts. If approved knowledge does not answer the question, say clinic staff must confirm it. Do not offer appointments, request a state, or mention internal systems. Do not include a purchase link or repeat the complete VIP program pitch; the application appends links and next actions when appropriate. Do not ask for the weight goal when it is already present in knownWeightGoal.`,
      input: JSON.stringify({
        customerMessage,
        knownWeightGoal: state.customerWeightGoal,
        structuredKnowledge: knowledge.structured.map(({ sourceType, content }) => ({ sourceType, content })),
        behavioralGuidance: knowledge.guidance.map(({ sourceType, content }) => ({ sourceType, content })),
        complianceRules: knowledge.compliance.map(({ content }) => content),
        approvedProgramFacts: {
          oneToOneSupport: 'Ongoing personalized customer-support guidance during the program; do not describe it as a medical consultation unless retrieved knowledge explicitly says so.',
          includedSupport: ['personalized support', 'medical supervision', 'nutritional guide', 'exercise guide'],
          fulfillment: 'If clinically approved, orders ship in 3-5 business days from a USA-based 503(a) pharmacy.',
          startingPrices: { semaglutide: '$199', tirzepatide: '$299' },
        },
      }),
    })
    answer = response.output_text.trim()
  }

  if (options.includeOffer) {
    const acknowledgment = state.preferredLanguage === 'es'
      ? 'Gracias por compartir tu objetivo. Te acompañaremos con un enfoque personalizado, sujeto siempre a aprobación clínica.'
      : state.preferredLanguage === 'pt'
        ? 'Obrigada por compartilhar seu objetivo. Vamos apoiar você com uma abordagem personalizada, sempre sujeita à aprovação clínica.'
        : 'Thank you for sharing your goal. We’ll support you with a personalized approach, always subject to clinical approval.'
    return [answer, acknowledgment, claudiaOffer(state.preferredLanguage, options.salesUrl)].filter(Boolean).join('\n\n')
  }
  if (options.includeLinkOnly && options.salesUrl) {
    const intro = state.preferredLanguage === 'es' ? 'Aquí tienes el enlace:' : state.preferredLanguage === 'pt' ? 'Aqui está o link:' : 'Here is the link:'
    return [answer, `${intro}\n\n${options.salesUrl}`].filter(Boolean).join('\n\n')
  }
  if (!state.customerWeightGoal) return [answer, askWeightGoal(state.preferredLanguage)].filter(Boolean).join('\n\n')
  const nextAction = state.preferredLanguage === 'es'
    ? '💚✨ ¿Te gustaría avanzar con el programa o hay alguna duda que pueda aclararte antes? 😊'
    : state.preferredLanguage === 'pt'
      ? '💚✨ Você gostaria de avançar com o programa ou há alguma dúvida que eu possa esclarecer antes? 😊'
      : '💚✨ Would you like to move forward with the program, or is there anything I can clarify for you first? 😊'
  return [answer || (state.preferredLanguage === 'es' ? 'Estoy aquí para ayudarte.' : state.preferredLanguage === 'pt' ? 'Estou aqui para ajudar você.' : 'I’m here to help.'), nextAction].join('\n\n')
}
