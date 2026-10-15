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
  const postPurchase = language === 'es'
    ? 'Después de tu compra, un representante de Dharma te llamará, te explicará todo el proceso, te entregará las guías de nutrición y ejercicio y te acompañará durante el programa.'
    : language === 'pt'
      ? 'Depois da compra, um representante da Dharma ligará para você, explicará todo o processo, fornecerá os guias de nutrição e exercícios e acompanhará você durante o programa.'
      : 'After your purchase, a Dharma customer representative will call you, explain the complete process, provide your nutrition and exercise guides, and take care of you throughout the program.'
  if (language === 'es') return `🌟 Así funciona nuestro Programa VIP Dharma:

• 🤝 Atención 1:1 con nuestro equipo de soporte
• 💚 Apoyo personalizado
• 🩺 Supervisión médica durante todo el programa
• 🥗 Guía nutricional
• 💪 Guía de ejercicios
• 📦 Medicamentos enviados desde una farmacia 503(a) con sede en EE. UU.
• 🚚 Si recibes aprobación, tu pedido se envía en 3–5 días hábiles

Semaglutida desde $199 y Tirzepatida desde $299. La aprobación médica es obligatoria.

${postPurchase}

${salesUrl ? '✨ Puedes dar el siguiente paso aquí:' : ''}${link}`
  if (language === 'pt') return `🌟 Veja como funciona o nosso Programa VIP Dharma:

• 🤝 Atendimento individual com nossa equipe de suporte
• 💚 Suporte personalizado
• 🩺 Supervisão médica durante todo o programa
• 🥗 Guia nutricional
• 💪 Guia de exercícios
• 📦 Medicamentos enviados por uma farmácia 503(a) sediada nos EUA
• 🚚 Se houver aprovação, seu pedido será enviado em 3–5 dias úteis

Semaglutida a partir de US$ 199 e Tirzepatida a partir de US$ 299. A aprovação médica é obrigatória.

${postPurchase}

${salesUrl ? '✨ Você pode dar o próximo passo aqui:' : ''}${link}`
  return `🌟 This is how our VIP Dharma Program works:

• 🤝 1:1 support from our customer support team
• 💚 Personalized support
• 🩺 Medical supervision throughout the full program
• 🥗 Nutritional guide
• 💪 Exercise guide
• 📦 Medication shipped from a USA-based 503(a) pharmacy
• 🚚 If approved, your order ships within 3–5 business days

Semaglutide starts at $199 and Tirzepatide starts at $299. Medical approval is required.

${postPurchase}

${salesUrl ? '✨ You can take the next step here:' : ''}${link}`
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
  if (analysis.questionTopics.length > 0 && !customerRequestsSalesLink(customerMessage)) {
    const response = await openai.responses.create({
      model: env.OPENAI_MODEL,
      store: false,
      instructions: `You are Claudia from Dharma Nutrition Clinic: an empathetic, energetic, highly conversational sales concierge. Reply in ${state.preferredLanguage === 'es' ? 'Spanish' : state.preferredLanguage === 'pt' ? 'Portuguese' : 'English'}.
Answer only the customer's current question using structuredKnowledge and behavioralGuidance, applying complianceRules first. Be concise: normally one or two short paragraphs with 1 to 3 relevant emojis. Do not repeat the customer's goal, the full VIP program, prices, shipping details, pharmacy details, or facts already communicated unless the customer specifically asks about them. Be encouraging and persuasive without pressure, guarantees, or exaggerated claims.
Never diagnose, prescribe, determine eligibility, promise results, or invent facts. If approved knowledge does not answer the question, say clinic staff must confirm it. Claudia's job is to answer the customer's questions, clearly explain what the treatment and program involve, and help the customer purchase through checkout when ready. Never offer or schedule an appointment, consultation, analysis call, or booking before purchase. Explain when relevant that after purchase a Dharma customer representative will call, explain the process, provide the nutrition and exercise guides, and take care of the customer throughout the program. Do not request a state or mention internal systems. Never say that you cannot share links, cannot send a link, or that another app or person must provide a link. Do not include a purchase URL in your generated answer or repeat the complete VIP program pitch; the application appends the real configured link when appropriate. Do not ask for the weight goal when it is already present in knownWeightGoal.`,
      input: JSON.stringify({
        customerMessage,
        knownWeightGoal: state.customerWeightGoal,
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
    answer = response.output_text.trim()
  }

  if (options.includeOffer) {
    const acknowledgment = state.preferredLanguage === 'es'
      ? '💚 Tu objetivo es algo que nuestro equipo puede ayudarte a alcanzar. Como puedes ver en estas fotos, algunos de nuestros pacientes han reportado perder más de 60 lb. Los resultados individuales varían y se requiere aprobación médica. ✨'
      : state.preferredLanguage === 'pt'
        ? '💚 Sua meta é algo que nossa equipe pode ajudar você a alcançar. Como você pode ver nestas fotos, alguns de nossos pacientes relataram perder mais de 60 lb. Os resultados individuais variam e a aprovação médica é obrigatória. ✨'
        : '💚 Your goal is something our team can help you work toward. As you can see in these photos, some of our patients have reported losing 60+ lbs. Individual results vary, and medical approval is required. ✨'
    return [answer, acknowledgment, claudiaOffer(state.preferredLanguage, options.salesUrl)].filter(Boolean).join('\n\n')
  }
  if (options.includeLinkOnly && options.salesUrl) {
    return [answer, options.salesUrl].filter(Boolean).join('\n\n')
  }
  if (!state.customerWeightGoal) return [answer, askWeightGoal(state.preferredLanguage)].filter(Boolean).join('\n\n')
  const nextAction = state.preferredLanguage === 'es'
    ? '💚✨ ¿Te gustaría avanzar con el programa o hay alguna duda que pueda aclararte antes? 😊'
    : state.preferredLanguage === 'pt'
      ? '💚✨ Você gostaria de avançar com o programa ou há alguma dúvida que eu possa esclarecer antes? 😊'
      : '💚✨ Would you like to move forward with the program, or is there anything I can clarify for you first? 😊'
  return [answer || (state.preferredLanguage === 'es' ? 'Estoy aquí para ayudarte.' : state.preferredLanguage === 'pt' ? 'Estou aqui para ajudar você.' : 'I’m here to help.'), nextAction].join('\n\n')
}
