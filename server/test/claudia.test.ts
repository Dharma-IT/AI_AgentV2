import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryConversationRepository } from '../src/repositories/conversation.repository.js'
import { analysis, ConversationService } from '../src/services/conversation.service.js'
import { claudiaGreetingForLanguage, claudiaIntroductionForLanguage, claudiaOffer, customerRequestsSalesLink, generateClaudiaReply } from '../src/services/claudia.service.js'
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
  assert.doesNotMatch(claudiaIntroductionForLanguage('en'), /weight goal/i)
  assert.match(claudiaGreetingForLanguage('en'), /weight goal/i)
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
  assert.match(first.reply, /https:\/\/example.com\/buy/)

  setAnalysis(analysis({ detectedLanguage: 'en', questionTopics: ['other'] }))
  const followUp = await instance.processMessage(conversation.id, 'Tell me more')
  assert.doesNotMatch(followUp.reply, /example.com/)

  setAnalysis(analysis({ detectedLanguage: 'en' }))
  const link = await instance.processMessage(conversation.id, 'Can I get the purchase link?')
  assert.match(link.reply, /https:\/\/example.com\/buy/)
})

test('Claudia identifies explicit sales-link requests', () => {
  assert.equal(customerRequestsSalesLink('Can I get the purchase link?'), true)
  assert.equal(customerRequestsSalesLink('What ingredients are used?'), false)
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
