import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseIncomingWebhook } from '../src/respond/respond-webhook.service.js'
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

describe('Respond conversation reset', () => {
  it('removes retained flow state so Reset actions starts Maria fresh', () => {
    setRespondConversationId('552034219', 'old-conversation')
    assert.equal(getRespondConversationId('552034219'), 'old-conversation')
    resetRespondConversationSession('552034219')
    assert.equal(getRespondConversationId('552034219'), undefined)
  })
})
