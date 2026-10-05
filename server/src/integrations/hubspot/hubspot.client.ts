import { env } from '../../config/env.js'
import { readJson, type FetchImplementation } from '../http-client.js'

const HUBSPOT_BASE_URL = 'https://api.hubapi.com'
const SCHEDULER_VERSION = '2026-09'

export interface HubSpotOwner {
  id: string
  userId?: number
  email: string
  firstName: string
  lastName: string
  archived: boolean
}

export interface HubSpotMeetingLink {
  id: string
  name: string
  slug: string
  link: string
  type: 'PERSONAL_LINK' | 'GROUP_CALENDAR' | 'ROUND_ROBIN_CALENDAR'
  organizerUserId: string
  userIdsOfLinkMembers?: string[]
}

interface ResultsPage<T> {
  results: T[]
  total?: number
}

export interface HubSpotAvailability {
  linkAvailability?: {
    hasMore?: boolean
    linkAvailabilityByDuration?: Record<string, {
      meetingDurationMillis: number
      availabilities: Array<{ startMillisUtc: number; endMillisUtc: number }>
    }>
  }
}

export type HubSpotBookingInput = {
  slug: string
  startTime: number
  duration: number
  timezone: string
  email: string
  firstName: string
  lastName: string
  phone: string
  agentName: string
}

export type HubSpotBooking = {
  bookingTimezone: string
  calendarEventId: string
  contactId: string
  duration: number
  start: string
  end: string
  isOffline: boolean
  subject: string
}

type HubSpotObject = { id: string; properties: Record<string, string | null> }

export class HubSpotClient {
  constructor(
    private readonly token = env.HUBSPOT_PRIVATE_APP_TOKEN,
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {}

  private headers(): Record<string, string> {
    if (!this.token) throw new Error('HUBSPOT_PRIVATE_APP_TOKEN is not configured')
    return { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchImplementation(`${HUBSPOT_BASE_URL}${path}`, {
      headers: this.headers(),
    })
    return readJson<T>('HubSpot', response)
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImplementation(`${HUBSPOT_BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return readJson<T>('HubSpot', response)
  }

  private async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImplementation(`${HUBSPOT_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return readJson<T>('HubSpot', response)
  }

  async listOwners(): Promise<HubSpotOwner[]> {
    return (await this.get<ResultsPage<HubSpotOwner>>('/crm/v3/owners?limit=500&archived=false')).results
  }

  async listMeetingLinks(): Promise<HubSpotMeetingLink[]> {
    return (await this.get<ResultsPage<HubSpotMeetingLink>>(
      `/scheduler/${SCHEDULER_VERSION}/meetings/meeting-links?limit=100`,
    )).results
  }

  async getAvailability(slug: string, timezone: string, monthOffset = 0): Promise<HubSpotAvailability> {
    const encodedSlug = encodeURIComponent(slug)
    const query = new URLSearchParams({ timezone, monthOffset: String(monthOffset) })
    return this.get<HubSpotAvailability>(
      `/scheduler/${SCHEDULER_VERSION}/meetings/meeting-links/book/availability-page/${encodedSlug}?${query}`,
    )
  }

  async bookMeeting(input: HubSpotBookingInput): Promise<HubSpotBooking> {
    return this.post<HubSpotBooking>(`/scheduler/${SCHEDULER_VERSION}/meetings/meeting-links/book`, {
      slug: input.slug,
      startTime: input.startTime,
      duration: input.duration,
      timezone: input.timezone,
      locale: 'en-us',
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      formFields: [
        { name: 'create_deal', value: 'false' },
        { name: 'agent_lead_management', value: input.agentName },
        { name: 'dont_send_notification', value: 'false' },
      ],
      legalConsentResponses: [],
      likelyAvailableUserIds: [],
    })
  }


  async updateContactPhone(contactId: string, phone: string) {
    return this.patch<{ id: string }>(`/crm/v3/objects/contacts/${encodeURIComponent(contactId)}`, {
      properties: { phone },
    })
  }


  async listContactMeetings(contactId: string) {
    return (await this.get<ResultsPage<{ id: string }>>(
      `/crm/v3/objects/contacts/${encodeURIComponent(contactId)}/associations/meetings?limit=100`,
    )).results
  }

  async getMeeting(meetingId: string) {
    return this.get<HubSpotObject>(
      `/crm/v3/objects/meetings/${encodeURIComponent(meetingId)}?properties=hs_meeting_start_time,hs_timestamp,hubspot_owner_id,hs_meeting_body`,
    )
  }

  async updateMeetingBody(meetingId: string, body: string) {
    return this.patch<HubSpotObject>(`/crm/v3/objects/meetings/${encodeURIComponent(meetingId)}`, {
      properties: { hs_meeting_body: body },
    })
  }

  async createDeal(input: { name: string; pipeline: string; stage: string; ownerId: string; contactId: string; meetingId: string; evaluationDateTime: string }) {
    return this.post<HubSpotObject>('/crm/v3/objects/deals', {
      properties: {
        dealname: input.name,
        pipeline: input.pipeline,
        dealstage: input.stage,
        hubspot_owner_id: input.ownerId,
        evaluation_date_and_hour_2: input.evaluationDateTime,
      },
      associations: [
        { to: { id: input.contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] },
        { to: { id: input.meetingId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 211 }] },
      ],
    })
  }
}
