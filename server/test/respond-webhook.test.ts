import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { contactAfterWorkflowGracePeriod, incomingEventIsStillLatest, inferredLanguage, isPlatformUnsupportedPlaceholder, latestIncomingTextBurst, parseIncomingWebhook, payloadContainsPlatformUnsupportedPlaceholder, RESPOND_WORKFLOW_GRACE_PERIOD_MS } from '../src/respond/respond-webhook.service.js'
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
      messageId: '99', messageType: 'text', text: 'AI Agent Test', hasAttachments: false, hasTransferableMedia: false, isUnassigned: true,
    })
  })
})

describe('Respond workflow grace period', () => {
  it('waits 20 seconds before reading the live assignment state', async () => {
    const calls: string[] = []
    let waitedFor = 0
    const contact = await contactAfterWorkflowGracePeriod(
      async () => {
        calls.push('getContact')
        return { assignee: { id: 123 }, language: 'es' }
      },
      async (milliseconds) => {
        calls.push('wait')
        waitedFor = milliseconds
      },
    )

    assert.equal(waitedFor, RESPOND_WORKFLOW_GRACE_PERIOD_MS)
    assert.deepEqual(calls, ['wait', 'getContact'])
    assert.deepEqual(contact, { assignee: { id: 123 }, language: 'es' })
  })

  it('suppresses an event when a newer inbound or outbound message exists', () => {
    const message = (messageId: number, traffic: 'incoming' | 'outgoing') => ({
      messageId, contactId: 1, channelId: 1, traffic,
      message: { type: 'text', text: 'test' },
    })
    assert.equal(incomingEventIsStillLatest([message(100, 'incoming')], '100'), true)
    assert.equal(incomingEventIsStillLatest([message(101, 'incoming'), message(100, 'incoming')], '100'), false)
    assert.equal(incomingEventIsStillLatest([message(100, 'incoming'), message(101, 'incoming')], '100'), false)
    assert.equal(incomingEventIsStillLatest([message(101, 'outgoing'), message(100, 'incoming')], '100'), false)
  })

  it('combines consecutive inbound text fragments for the newest event', () => {
    const message = (messageId: number, traffic: 'incoming' | 'outgoing', text: string, type = 'text') => ({
      messageId, contactId: 1, channelId: 1, traffic,
      message: { type, text },
    })
    const messages = [
      message(103, 'incoming', 'Quintanilla'),
      message(102, 'incoming', '', 'unsupported'),
      message(101, 'incoming', 'Brenda'),
      message(100, 'outgoing', '¿Cuál es tu nombre completo?'),
    ]
    assert.equal(latestIncomingTextBurst(messages, '103', 'Quintanilla'), 'Brenda\nQuintanilla')
    assert.equal(latestIncomingTextBurst(messages, '101', 'Brenda'), null)
  })
})

it('ignores the Instagram unsupported-message placeholder without treating normal text as unsupported', () => {
  assert.equal(isPlatformUnsupportedPlaceholder('Unsupported Message'), true)
  assert.equal(isPlatformUnsupportedPlaceholder('  unsupported message  '), true)
  assert.equal(isPlatformUnsupportedPlaceholder('I cannot understand this message'), false)
  assert.equal(payloadContainsPlatformUnsupportedPlaceholder({ message: { content: { title: 'Unsupported Message' } } }), true)
  assert.equal(payloadContainsPlatformUnsupportedPlaceholder({ message: { text: 'A normal message' } }), false)
})

it('only marks image and voice/audio attachments for Front Desk transfer', () => {
  const image = parseIncomingWebhook({ message: { type: 'attachment', attachments: [{ type: 'image/jpeg' }] } })
  const voice = parseIncomingWebhook({ message: { type: 'attachment', attachments: [{ mimeType: 'audio/ogg' }] } })
  const contactCard = parseIncomingWebhook({ message: { type: 'attachment', attachments: [{ type: 'contact' }] } })
  assert.equal(image.hasTransferableMedia, true)
  assert.equal(voice.hasTransferableMedia, true)
  assert.equal(contactCard.hasTransferableMedia, false)
})

it('infers a missing Respond.io language while preserving an existing one', () => {
  assert.equal(inferredLanguage(null, 'Hola'), 'es')
  assert.equal(inferredLanguage(null, 'Olá'), 'pt')
  assert.equal(inferredLanguage(null, 'Hello'), 'en')
  assert.equal(inferredLanguage(null, '160'), 'es')
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
