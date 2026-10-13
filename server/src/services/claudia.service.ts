import { env } from '../config/env.js'
import type { ConversationState, MessageAnalysis } from '../domain/conversation.js'
import type { KnowledgeContext } from '../knowledge/knowledge.types.js'
import { openai } from '../lib/openai.js'

export function claudiaGreetingForLanguage(language: 'en' | 'es' | 'pt') {
  if (language === 'es') return `¡Hola! Soy Claudia de Dharma Clinic 🌿

Estoy aquí para ayudarte a conocer nuestro programa personalizado para bajar de peso y responder tus preguntas.

¿Cuál es tu principal objetivo de peso en este momento?`
  if (language === 'pt') return `Olá! Sou Claudia da Dharma Clinic 🌿

Estou aqui para ajudar você a conhecer nosso programa personalizado de perda de peso e responder às suas perguntas.

Qual é o seu principal objetivo de peso neste momento?`
  return `Hello! I'm Claudia from Dharma Clinic 🌿

I'm here to help you learn about our personalized weight-loss program and answer your questions.

What is your main weight goal right now?`
}

export function customerRequestsSalesLink(message: string) {
  return /\b(?:link|buy|purchase|order|checkout|comprar|pedido|enlace|liga[cç][aã]o)\b/iu.test(message)
}

export function claudiaOffer(language: ConversationState['preferredLanguage'], salesUrl: string | null) {
  const link = salesUrl ? `\n\n${salesUrl}` : ''
  if (language === 'es') return `Nuestro Programa VIP Dharma incluye:

• Atención 1:1 con nuestro equipo de soporte
• Apoyo personalizado
• Supervisión médica durante todo el programa
• Guía nutricional
• Guía de ejercicios
• Medicamentos enviados desde una farmacia 503(a) con sede en EE. UU.
• Si recibes aprobación, tu pedido se envía en 3–5 días hábiles

Semaglutida desde $199 y Tirzepatida desde $299. La aprobación clínica es obligatoria.${link}`
  if (language === 'pt') return `Nosso Programa VIP Dharma inclui:

• Atendimento individual com nossa equipe de suporte
• Suporte personalizado
• Supervisão médica durante todo o programa
• Guia nutricional
• Guia de exercícios
• Medicamentos enviados por uma farmácia 503(a) sediada nos EUA
• Se houver aprovação, seu pedido será enviado em 3–5 dias úteis

Semaglutida a partir de US$ 199 e Tirzepatida a partir de US$ 299. A aprovação clínica é obrigatória.${link}`
  return `Our VIP Dharma Program includes:

• 1:1 support from our customer support team
• Personalized support
• Medical supervision throughout the full program
• Nutritional guide
• Exercise guide
• Medication shipped from a USA-based 503(a) pharmacy
• If approved, your order ships within 3–5 business days

Semaglutide starts at $199 and Tirzepatide starts at $299. Clinical approval is required.${link}`
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
      instructions: `You are Claudia from Dharma Nutrition Clinic, a warm, concise sales concierge. Reply in ${state.preferredLanguage === 'es' ? 'Spanish' : state.preferredLanguage === 'pt' ? 'Portuguese' : 'English'}.
Answer the customer's question only from structuredKnowledge and behavioralGuidance, applying complianceRules first. Never diagnose, prescribe, determine eligibility, promise results, or invent facts. If approved knowledge does not answer the question, say clinic staff must confirm it. Do not offer appointments, request a state, or mention internal systems. Do not include a purchase link or repeat the VIP program pitch; the application appends those when appropriate.`,
      input: JSON.stringify({
        customerMessage,
        knownWeightGoal: state.customerWeightGoal,
        structuredKnowledge: knowledge.structured.map(({ sourceType, content }) => ({ sourceType, content })),
        behavioralGuidance: knowledge.guidance.map(({ sourceType, content }) => ({ sourceType, content })),
        complianceRules: knowledge.compliance.map(({ content }) => content),
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
  return answer || (state.preferredLanguage === 'es' ? '¿Qué más te gustaría saber?' : state.preferredLanguage === 'pt' ? 'O que mais você gostaria de saber?' : 'What else would you like to know?')
}
