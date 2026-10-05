import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { inferredLanguage, isPlatformUnsupportedPlaceholder, parseIncomingWebhook } from '../src/respond/respond-webhook.service.js'
import { getRespondConversationId, resetRespondConversationSession, setRespondConversationId } from '../src/respond/respond-session.service.js'

describe('Respond incoming webhook parsing', () => {
  it('extracts nested Respond contact, channel, assignee, and text fields', () => {
    const parsed = parseIncomingWebhook({
      contact: { id: 552034219, firstName: 'Jeuz', lastName: 'Bas', assignee: null },
      channel: { id: 333332 },
      message: { id: 99, type: 'text', text: 'AI Agent Test' },
    })
    assert.deepEqual(parsed, {
      contactId: '552034219', contactName: 'Jeuz Bas', channelId: 333332,
      messageId: '99', messageType: 'text', text: 'AI Agent Test', hasAttachments: false, isUnassigned: true,
    })
  })
})

it('ignores the Instagram unsupported-message placeholder without treating normal text as unsupported', () => {
  assert.equal(isPlatformUnsupportedPlaceholder('Unsupported Message'), true)
  assert.equal(isPlatformUnsupportedPlaceholder('  unsupported message  '), true)
  assert.equal(isPlatformUnsupportedPlaceholder('I cannot understand this message'), false)
})

it('infers a missing Respond.io language while preserving an existing one', () => {
  assert.equal(inferredLanguage(null, 'Hola'), 'es')
  assert.equal(inferredLanguage(null, 'Olá'), 'pt')
  assert.equal(inferredLanguage(null, 'Hello'), 'en')
  assert.equal(inferredLanguage('es', 'Hello'), 'es')
})

describe('Respond conversation reset', () => {
  it('removes retained flow state so Reset actions starts Maria fresh', () => {
    setRespondConversationId('552034219', 'old-conversation', '2026-10-05T19:35:32Z')
    assert.equal(getRespondConversationId('552034219', '2026-10-05T19:35:32Z'), 'old-conversation')
    assert.equal(getRespondConversationId('552034219', '2026-10-05T19:36:00Z'), undefined)
    setRespondConversationId('552034219', 'another-conversation', null)
    resetRespondConversationSession('552034219')
    assert.equal(getRespondConversationId('552034219', null), undefined)
  })
})
