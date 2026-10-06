import assert from 'node:assert/strict'
import test from 'node:test'
import { RespondClient } from '../src/integrations/respond/respond.client.js'

test('lists Respond.io workspace channels with their stable IDs and sources', async () => {
  let requestedUrl = ''
  const client = new RespondClient('token', (async (input) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({ items: [
      { id: 493621, name: 'Dharma - (561) 884-2047', source: 'whatsapp_business' },
      { id: 556661, name: 'Dharma Facebook', source: 'facebook' },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch)

  const channels = await client.listChannels()
  assert.match(requestedUrl, /\/v2\/space\/channel\?limit=100$/)
  assert.deepEqual(channels.map(({ id, source }) => ({ id, source })), [
    { id: 493621, source: 'whatsapp_business' },
    { id: 556661, source: 'facebook' },
  ])
})

test('sends images and videos as Respond.io attachment messages', async () => {
  const requests: Array<{ url: string; body: unknown }> = []
  const client = new RespondClient('token', (async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ id: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch)

  await client.sendAttachmentMessage('id:42', {
    type: 'image', url: 'https://example.com/welcome.jpg', mimeType: 'image/jpeg', fileName: 'welcome.jpg', description: 'Welcome',
  })
  await client.sendAttachmentMessage('id:42', {
    type: 'video', url: 'https://example.com/evaluation.mp4', mimeType: 'video/mp4', fileName: 'evaluation.mp4',
  })

  assert.match(requests[0]!.url, /\/contact\/id%3A42\/message$/)
  assert.deepEqual(requests.map(({ body }) => body), [
    { message: { type: 'attachment', attachment: { type: 'image', url: 'https://example.com/welcome.jpg', mimeType: 'image/jpeg', fileName: 'welcome.jpg', description: 'Welcome' } } },
    { message: { type: 'attachment', attachment: { type: 'video', url: 'https://example.com/evaluation.mp4', mimeType: 'video/mp4', fileName: 'evaluation.mp4' } } },
  ])
})
