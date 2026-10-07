import type { AppointmentSlot, PreferredLanguage } from '../domain/conversation.js'
import { HubSpotClient } from '../integrations/hubspot/hubspot.client.js'
import { findEligibleUserByHubSpotUserId } from '../integrations/user-mapping/user-mapping.js'
import { getAgentCallbackNumber } from './agent-callback.service.js'

const hubspotAgentNames: Record<number, string> = {
  77394941: 'Edmilson Morales',
  62115861: 'Aline Strelow',
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
}

function formatDateTime(slot: AppointmentSlot, language: PreferredLanguage) {
  const locale = language === 'es' ? 'es-US' : language === 'pt' ? 'pt-US' : 'en-US'
  return new Intl.DateTimeFormat(locale, {
    timeZone: slot.timezone,
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(Date.parse(slot.startTime))
}

export async function bookAppointment(input: {
  slot: AppointmentSlot
  phone: string
  fullName: string
  language: PreferredLanguage
}, client: Pick<HubSpotClient, 'bookMeeting' | 'updateContactPhone' | 'listContactMeetings' | 'getMeeting' | 'updateMeetingBody' | 'createDeal'> = new HubSpotClient()) {
  const mapping = findEligibleUserByHubSpotUserId(input.slot.hubspotUserId)
  if (!mapping) throw new Error('Selected appointment owner is not booking eligible')
  const { firstName, lastName } = splitName(input.fullName)
  const booking = await client.bookMeeting({
    slug: input.slot.meetingLinkSlug,
    startTime: Date.parse(input.slot.startTime),
    duration: Date.parse(input.slot.endTime) - Date.parse(input.slot.startTime),
    timezone: input.slot.timezone,
    email: `${input.phone}@dummy.com`,
    firstName,
    lastName,
    phone: input.phone,
    agentName: hubspotAgentNames[mapping.hubspotUserId] ?? mapping.canonicalName,
  })
  if (!booking.calendarEventId || !booking.contactId || booking.isOffline) {
    throw new Error('HubSpot did not confirm an online calendar booking')
  }
  await client.updateContactPhone(booking.contactId, `+${input.phone}`)
  let meetingId: string | undefined
  let meetingBody: string | null = null
  for (let attempt = 0; attempt < 4 && !meetingId; attempt += 1) {
    const meetings = await client.listContactMeetings(booking.contactId)
    for (const meeting of meetings) {
      const record = await client.getMeeting(meeting.id)
      const start = record.properties.hs_meeting_start_time ?? record.properties.hs_timestamp
      if (start && Math.abs(Date.parse(start) - Date.parse(input.slot.startTime)) < 60_000) {
        meetingId = meeting.id
        meetingBody = record.properties.hs_meeting_body ?? null
        break
      }
    }
    if (!meetingId && attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!meetingId) throw new Error('HubSpot booked the calendar event but its meeting record could not be resolved')
  if (meetingBody) {
    const populatedBody = meetingBody
      .replace(/<p>Phone:\s*<\/p>/i, `<p>Phone: +${input.phone}</p>`)
      .replace(/<p>Desired Treatment:\s*<\/p>/i, '<p>Desired Treatment: WLI</p>')
    await client.updateMeetingBody(meetingId, populatedBody)
  }
  const isSales = mapping.team === 'sales'
  const deal = await client.createDeal({
    name: `${isSales ? 'Seller' : 'CS'} - ${input.fullName}`,
    pipeline: isSales ? '693198644' : '709161049',
    stage: isSales ? '1013987700' : '1036251693',
    ownerId: String(mapping.hubspotOwnerId),
    contactId: booking.contactId,
    meetingId,
    evaluationDateTime: input.slot.startTime,
  })
  const callback = await getAgentCallbackNumber(mapping.hubspotUserId)
  const when = formatDateTime(input.slot, input.language)
  const number = callback.digits.trim().replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  const agentFirstName = callback.agentName.trim().split(/\s+/)[0]!
  const confirmation = input.language === 'es'
    ? `📲 Su videollamada informativa gratuita está programada para ${when} (${input.slot.timezoneLabel}) con ${agentFirstName}. 🥰\n\n📲 Si necesita ayuda el día de su cita, nuestro especialista le llamará desde este número: ${number}.\n\n⏰ Recuerde que la hora indicada corresponde a ${input.slot.timezoneLabel}.\n\n⚠️ Por favor, asegúrese de estar disponible para mantener su descuento. No podemos garantizar una cita para el mismo día si pierde la programada debido a la alta demanda en la clínica.`
    : input.language === 'pt'
      ? `📲 Sua videochamada informativa gratuita está agendada para ${when} (${input.slot.timezoneLabel}) com ${agentFirstName}. 🥰\n\n📲 Se precisar de ajuda no dia da consulta, nosso especialista ligará deste número: ${number}.\n\n⏰ Lembre-se de que o horário mostrado está em ${input.slot.timezoneLabel}.\n\n⚠️ Esteja disponível para sua ligação inicial para manter o desconto. Devido à alta demanda, não podemos garantir o reagendamento para o mesmo dia se a consulta for perdida.`
      : `📲 Your free informational video call is scheduled for ${when} (${input.slot.timezoneLabel}) with ${agentFirstName}. 🥰\n\n📲 If you need assistance on the day of your appointment, our specialist will call you from ${number}.\n\n⏰ Please remember the time shown is in ${input.slot.timezoneLabel}.\n\n⚠️ Please be available for your initial call to keep your discount. Due to high demand, we cannot guarantee same-day rescheduling if the appointment is missed.`
  const financing = input.language === 'es'
    ? '😊 Si prefieres pagar en cuotas, tenemos opciones de financiamiento disponibles. Puedes hacer tu registro previo aquí antes de la consulta:\n\n🔗 https://linktr.ee/dharmapayments\n\n¡Así hacemos todo más ágil para ti! 💛'
    : input.language === 'pt'
      ? '😊 Se preferir pagar parcelado, temos opções de financiamento disponíveis. Você pode fazer seu pré-cadastro aqui antes da consulta:\n\n🔗 https://linktr.ee/dharmapayments\n\nIsso ajuda a tornar tudo mais rápido para você! 💛'
      : '😊 If you prefer to pay in installments, financing options are available. You can pre-register here before your consultation:\n\n🔗 https://linktr.ee/dharmapayments\n\nThis helps make everything quicker for you! 💛'
  return { booking, meetingId, dealId: deal.id, confirmation, financing }
}
