import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryConversationRepository } from '../src/repositories/conversation.repository.js'
import { analysis, ConversationService } from '../src/services/conversation.service.js'
import { claudiaGreetingForLanguage, claudiaIntroductionForLanguage, claudiaOffer, claudiaQuestionTransition, customerRequestsSalesLink, generateClaudiaReply } from '../src/services/claudia.service.js'
import type { KnowledgeContext } from '../src/knowledge/knowledge.types.js'

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
  assert.match(first.reply, /Medical approval/)
  assert.match(first.reply, /https:\/\/example.com\/buy/)
  assert.equal(first.plan.includeResultsImage, true)

  setAnalysis(analysis({ detectedLanguage: 'en', questionTopics: ['other'] }))
  const followUp = await instance.processMessage(conversation.id, 'Tell me more')
  assert.doesNotMatch(followUp.reply, /example.com/)

  setAnalysis(analysis({ detectedLanguage: 'en' }))
  const link = await instance.processMessage(conversation.id, 'Can I get the purchase link?')
  assert.match(link.reply, /https:\/\/example.com\/buy/)
})

test('Claudia frames patient examples safely before explaining the VIP program', async () => {
  const { instance } = service()
  const state = instance.createConversation('en', 'claudia')
  state.customerWeightGoal = 'lose 20 pounds'
  const reply = await generateClaudiaReply('I want to lose 20 pounds', state, analysis({ detectedLanguage: 'en', customerWeightGoal: 'lose 20 pounds' }), emptyKnowledge, {
    includeOffer: true, includeLinkOnly: false, salesUrl: 'https://example.com/buy',
  })
  assert.match(reply, /reported losing 60\+ lbs/)
  assert.match(reply, /Individual results vary/)
  assert.match(reply, /medical approval/i)
  assert.match(reply, /how our VIP Dharma Program works/i)
})

test('Claudia identifies explicit sales-link requests', () => {
  assert.equal(customerRequestsSalesLink('Can I get the purchase link?'), true)
  assert.equal(customerRequestsSalesLink('What ingredients are used?'), false)
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

test('Claudia follow-ups end with an empathetic sales action', async () => {
  const { instance } = service()
  const state = instance.createConversation('en', 'claudia')
  state.customerWeightGoal = 'lose 20 pounds'
  const reply = await generateClaudiaReply('Okay', state, analysis({ detectedLanguage: 'en' }), emptyKnowledge, {
    includeOffer: false, includeLinkOnly: false, salesUrl: null,
  })
  assert.match(reply, /💚✨/u)
  assert.match(reply, /move forward with the program/i)
  assert.doesNotMatch(reply, /main weight goal/i)
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
