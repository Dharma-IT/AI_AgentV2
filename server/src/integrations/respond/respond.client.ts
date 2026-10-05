import { env } from '../../config/env.js'
import { readJson, type FetchImplementation } from '../http-client.js'

const RESPOND_BASE_URL = 'https://api.respond.io/v2'

export interface RespondTeamReference {
  id: number
  name: string
}

export interface RespondUser {
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
  team: RespondTeamReference | null
}

export interface RespondChannel {
  id: number
  name: string
  source: string
  created_at?: number
}

export interface RespondContact {
  id: number
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  status: string
  assignee: { id: number; firstName: string; lastName: string; email: string } | null
}

interface RespondPage<T> {
  items: T[]
  pagination?: { next?: string | null }
}

export class RespondClient {
  constructor(
    private readonly token = env.RESPOND_API_TOKEN,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {}

  private headers(): Record<string, string> {
    if (!this.token) throw new Error('RESPOND_API_TOKEN is not configured')
    return { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }
  }

  async listUsers(limit = 100): Promise<RespondUser[]> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/space/user?limit=${limit}`,
      { headers: this.headers() },
    )
    return (await readJson<RespondPage<RespondUser>>('Respond.io', response)).items
  }

  async listChannels(limit = 100): Promise<RespondChannel[]> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/space/channel?limit=${limit}`,
      { headers: this.headers() },
    )
    return (await readJson<RespondPage<RespondChannel>>('Respond.io', response)).items
  }

  async getContact(identifier: string): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/${encodeURIComponent(identifier)}`,
      { headers: this.headers() },
    )
    return readJson('Respond.io', response)
  }

  async updateContactLanguage(identifier: string, language: 'en' | 'es' | 'pt'): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/${encodeURIComponent(identifier)}`,
      {
        method: 'PUT', headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      },
    )
    return readJson('Respond.io', response)
  }

  async updateContactCustomFields(identifier: string, customFields: Record<string, string>): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/${encodeURIComponent(identifier)}`,
      {
        method: 'PUT', headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_fields: Object.entries(customFields).map(([name, value]) => ({ name, value })),
        }),
      },
    )
    return readJson('Respond.io', response)
  }

  async searchContacts(search: string, limit = 25): Promise<RespondContact[]> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/list?limit=${limit}`,
      {
        method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ search, timezone: 'UTC', filter: { $and: [] } }),
      },
    )
    return (await readJson<RespondPage<RespondContact>>('Respond.io', response)).items
  }

  async assignConversation(identifier: string, respondUserId: number): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/${encodeURIComponent(identifier)}/conversation/assignee`,
      {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee: respondUserId }),
      },
    )
    return readJson('Respond.io', response)
  }

  async unassignConversation(identifier: string): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/${encodeURIComponent(identifier)}/conversation/assignee`,
      { method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ assignee: null }) },
    )
    return readJson('Respond.io', response)
  }

  async setConversationStatus(identifier: string, status: 'open' | 'close'): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/${encodeURIComponent(identifier)}/conversation/status`,
      { method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) },
    )
    return readJson('Respond.io', response)
  }

  async sendTextMessage(identifier: string, text: string): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/${encodeURIComponent(identifier)}/message`,
      { method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { type: 'text', text } }) },
    )
    return readJson('Respond.io', response)
  }
}
