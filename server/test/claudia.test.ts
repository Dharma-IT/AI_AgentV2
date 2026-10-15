import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryConversationRepository } from '../src/repositories/conversation.repository.js'
import { analysis, ConversationService } from '../src/services/conversation.service.js'
import { claudiaGreetingForLanguage, claudiaIntroductionForLanguage, claudiaOffer, claudiaQuestionTransition, customerRequestsSalesLink, generateClaudiaReply, removeQuestions } from '../src/services/claudia.service.js'
import type { KnowledgeContext } from '../src/knowledge/knowledge.types.js'
import { contextualWeightGoal } from '../src/services/maria.service.js'

const emptyKnowledge: KnowledgeContext = {
  requestId: 'test', language: 'en', structured: [], guidance: [], compliance: [],
  metadata: { durationMs: 0, categories: [], recordIds: [], noRelevantKnowledge: true, errors: [] },
}

function service() {
  let analyzed = analysis({ detectedLanguage: 'en', customerWeightGoal: 'lose 20 pounds' })
  const instance = new ConversationService({
    repository: new InMemoryConversationRepository(),
    analyze: async () => analyzed,
    generate: async () => 'Maria should not run',
    retrieve: async () => emptyKnowledge,
    generateClaudia: async (_message, state, _analysis, _knowledge, options) => options.includeOffer
      ? claudiaOffer(state.preferredLanguage, options.salesUrl)
      : options.includeLinkOnly && options.salesUrl ? `Link: ${options.salesUrl}` : 'How else can I help?',
    getClaudiaSalesUrl: async () => 'https://example.com/buy',
  })
  return { instance, setAnalysis: (value: typeof analyzed) => { analyzed = value } }
}

test('Claudia has localized greetings that request a weight goal', () => {
  assert.match(claudiaGreetingForLanguage('en'), /Claudia.*weight goal/s)
  assert.match(claudiaGreetingForLanguage('es'), /Claudia.*objetivo de peso/s)
  assert.match(claudiaGreetingForLanguage('pt'), /Claudia.*objetivo de peso/s)
})

test('Claudia introductions do not ask the goal before an initial question is answered', () => {
  assert.match(claudiaIntroductionForLanguage('en'), /I'm Claudia/)
  assert.match(claudiaIntroductionForLanguage('en'), /43 U\.S\. states/)
  assert.doesNotMatch(claudiaIntroductionForLanguage('en'), /weight goal/i)
  assert.match(claudiaGreetingForLanguage('en'), /weight goal/i)
  assert.equal(claudiaQuestionTransition('en'), 'To answer your question:')
  assert.equal(claudiaQuestionTransition('es'), 'Para responder a tu pregunta:')
  assert.equal(claudiaQuestionTransition('pt'), 'Para responder à sua pergunta:')
})

test('Claudia sends the complete sales offer and URL once, then resends only on request', async () => {
  const { instance, setAnalysis } = service()
  const conversation = instance.createConversation('en', 'claudia')
  const first = await instance.processMessage(conversation.id, 'I want to lose 20 pounds')
  assert.equal(first.state.personality, 'claudia')
  assert.equal(first.state.salesOfferSent, true)
  assert.match(first.reply, /1:1 support/)
  assert.match(first.reply, /503\(a\)/)
  assert.match(first.reply, /\$199/)
  assert.match(first.reply, /\$299/)
  assert.match(first.reply, /medical approval/i)
  assert.match(first.reply, /After purchase, a Dharma representative will call/)
  assert.match(first.reply, /support you throughout the program/)
  assert.match(first.reply, /https:\/\/example.com\/buy/)
  assert.equal(first.plan.includeResultsImage, true)

  setAnalysis(analysis({ detectedLanguage: 'en', questionTopics: ['other'] }))
  const followUp = await instance.processMessage(conversation.id, 'Tell me more')
  assert.doesNotMatch(followUp.reply, /example.com/)

  setAnalysis(analysis({ detectedLanguage: 'en' }))
  const link = await instance.processMessage(conversation.id, 'Can I get the purchase link?')
  assert.match(link.reply, /https:\/\/example.com\/buy/)
})

test('a bare number answers the active weight-goal question rather than pricing', () => {
  assert.equal(contextualWeightGoal('200', { lastAskedQuestion: 'weight_goal' }), '200 lb')
  assert.equal(contextualWeightGoal('200', { lastAskedQuestion: null }), null)
  assert.equal(contextualWeightGoal('$200', { lastAskedQuestion: 'weight_goal' }), null)
})

test('Claudia frames patient examples safely before explaining the VIP program', async () => {
  const { instance } = service()
  const state = instance.createConversation('en', 'claudia')
  state.customerWeightGoal = 'lose 20 pounds'
  const reply = await generateClaudiaReply('I want to lose 20 pounds', state, analysis({ detectedLanguage: 'en', customerWeightGoal: 'lose 20 pounds' }), emptyKnowledge, {
    includeOffer: true, includeLinkOnly: false, salesUrl: 'https://example.com/buy',
  })
  assert.match(reply, /reported losing 60\+ lbs/)
  assert.match(reply, /individual results vary/i)
  assert.match(reply, /medical approval/i)
  assert.match(reply, /VIP Dharma Program includes/i)
})

test('Claudia identifies explicit sales-link requests', () => {
  assert.equal(customerRequestsSalesLink('Can I get the purchase link?'), true)
  assert.equal(customerRequestsSalesLink('What ingredients are used?'), false)
})

test('an explicit link request returns the configured URL without refusal or redundant copy', async () => {
  const { instance } = service()
  const state = instance.createConversation('en', 'claudia')
  state.customerWeightGoal = 'lose 20 pounds'
  state.salesOfferSent = true
  const reply = await generateClaudiaReply('Can you share the link again?', state, analysis({ detectedLanguage: 'en', questionTopics: ['other'] }), emptyKnowledge, {
    includeOffer: false, includeLinkOnly: true, salesUrl: 'https://example.com/buy',
  })
  assert.equal(reply, 'https://example.com/buy')
  assert.doesNotMatch(reply, /cannot|can’t|VIP Dharma|\$199/i)
})

test('Claudia naturally re-offers the link after three follow-up questions', async () => {
  const { instance, setAnalysis } = service()
  const conversation = instance.createConversation('en', 'claudia')
  await instance.processMessage(conversation.id, 'I want to lose 20 pounds')
  setAnalysis(analysis({ detectedLanguage: 'en', questionTopics: ['other'] }))
  const first = await instance.processMessage(conversation.id, 'What support is included?')
  const second = await instance.processMessage(conversation.id, 'How does shipping work?')
  const third = await instance.processMessage(conversation.id, 'What happens after approval?')
  assert.doesNotMatch(first.reply, /example.com/)
  assert.doesNotMatch(second.reply, /example.com/)
  assert.match(third.reply, /https:\/\/example.com\/buy/)
  assert.equal(third.state.questionsSinceSalesLink, 0)
})

test('Claudia follow-ups after the offer use a polite statement without another action question', async () => {
  const { instance } = service()
  const state = instance.createConversation('en', 'claudia')
  state.customerWeightGoal = 'lose 20 pounds'
  const reply = await generateClaudiaReply('Okay', state, analysis({ detectedLanguage: 'en' }), emptyKnowledge, {
    includeOffer: false, includeLinkOnly: false, salesUrl: null,
  })
  assert.match(reply, /I’m here to help when you’re ready/i)
  assert.doesNotMatch(reply, /[?¿]/u)
  assert.doesNotMatch(reply, /main weight goal/i)
})

test('Claudia enforces at most one application-controlled question in every supported language', async () => {
  const questionMarks = (value: string) => value.match(/\?/gu)?.length ?? 0
  for (const language of ['en', 'es', 'pt'] as const) {
    const { instance } = service()
    const state = instance.createConversation(language, 'claudia')
    const noGoal = await generateClaudiaReply(
      'Tell me about it', state, analysis({ detectedLanguage: language }), emptyKnowledge,
      { includeOffer: false, includeLinkOnly: false, salesUrl: null },
    )
    assert.equal(questionMarks(noGoal), 1)

    state.customerWeightGoal = '20 lb'
    state.salesOfferSent = true
    const afterLink = await generateClaudiaReply(
      'Okay', state, analysis({ detectedLanguage: language }), emptyKnowledge,
      { includeOffer: false, includeLinkOnly: false, salesUrl: null },
    )
    assert.equal(questionMarks(afterLink), 0)
  }
})

test('model-authored questions are removed before application copy is appended', () => {
  assert.equal(removeQuestions('The program includes support. Would you like the link?'), 'The program includes support.')
  assert.equal(removeQuestions('Incluye apoyo. ¿Quieres comprar? El envío tarda de 3 a 5 días.'), 'Incluye apoyo. El envío tarda de 3 a 5 días.')
})

test('the complete sales offer is concise and contains no question after its purchase link', () => {
  for (const language of ['en', 'es', 'pt'] as const) {
    const offer = claudiaOffer(language, 'https://example.com/buy')
    assert.ok(offer.length < 700)
    assert.doesNotMatch(offer, /[?¿]/u)
    assert.match(offer, /https:\/\/example\.com\/buy/)
  }
})

test('Claudia restores an offered conversation from Respond history after memory loss', async () => {
  const { instance, setAnalysis } = service()
  const conversation = instance.createConversation('en', 'claudia')
  await instance.restoreClaudiaContext(conversation.id, [
    { messageId: 1, traffic: 'incoming', message: { text: 'I want to lose 20 pounds' } },
    { messageId: 2, traffic: 'outgoing', message: { text: 'Our VIP Dharma Program includes support from a 503(a) pharmacy.' } },
  ])
  setAnalysis(analysis({ detectedLanguage: 'en', questionTopics: ['other'] }))
  const result = await instance.processMessage(conversation.id, 'What is the support about?')
  assert.equal(result.state.customerWeightGoal, 'lose 20 pounds')
  assert.equal(result.state.salesOfferSent, true)
  assert.equal(result.state.currentStage, 'conversational')
  assert.doesNotMatch(result.reply, /example.com/)
})
