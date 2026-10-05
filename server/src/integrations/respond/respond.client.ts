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

  async getContact(identifier: string): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${RESPOND_BASE_URL}/contact/${encodeURIComponent(identifier)}`,
      { headers: this.headers() },
    )
    return readJson('Respond.io', response)
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
}
