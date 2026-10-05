import { env } from '../../config/env.js'
import { readJson, type FetchImplementation } from '../http-client.js'

const AIRCALL_BASE_URL = 'https://api.aircall.io/v1'

export interface AircallUser {
  id: number
  name: string
  email: string
  availability?: string
}

export interface AircallNumber {
  id: number
  name: string
  digits: string
  country: string
  open: boolean
  availability_status?: string
  priority?: number | null
}

export class AircallClient {
  constructor(
    private readonly apiId = env.AIRCALL_API_ID,
    private readonly apiToken = env.AIRCALL_API_TOKEN,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {}

  private headers(): Record<string, string> {
    if (!this.apiId || !this.apiToken) throw new Error('Aircall API credentials are not configured')
    const credentials = Buffer.from(`${this.apiId}:${this.apiToken}`).toString('base64')
    return { Authorization: `Basic ${credentials}`, Accept: 'application/json' }
  }

  async listUsers(): Promise<AircallUser[]> {
    const response = await this.fetchImplementation('https://api.aircall.io/v2/users?per_page=50', {
      headers: this.headers(),
    })
    return (await readJson<{ users: AircallUser[] }>('Aircall', response)).users
  }

  async listUserNumbers(userId: number): Promise<AircallNumber[]> {
    const response = await this.fetchImplementation(
      `https://api.aircall.io/v2/users/${userId}/numbers?per_page=50`,
      { headers: this.headers() },
    )
    return (await readJson<{ numbers: AircallNumber[] }>('Aircall', response)).numbers
  }

  async listRecentCalls(limit = 20): Promise<unknown> {
    const response = await this.fetchImplementation(
      `${AIRCALL_BASE_URL}/calls?per_page=${limit}&order=desc`,
      { headers: this.headers() },
    )
    return readJson('Aircall', response)
  }
}
