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
