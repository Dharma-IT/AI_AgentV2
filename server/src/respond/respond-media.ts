import { env } from '../config/env.js'
import type { RespondAttachment, RespondClient } from '../integrations/respond/respond.client.js'

function publicMediaUrl(path: string) {
  if (!env.SUPABASE_URL) return ''
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/maria-media/${path}`
}

export const welcomeImage: RespondAttachment = {
  type: 'image',
  url: env.MARIA_WELCOME_IMAGE_URL || publicMediaUrl('Images/WLI%20Image.jpg'),
  mimeType: 'image/jpeg',
  fileName: 'WLI Image.jpg',
  description: 'Dharma Clinic weight-loss information',
}

export const bookingVideo: RespondAttachment = {
  type: 'video',
  url: env.MARIA_BOOKING_VIDEO_URL || publicMediaUrl('Videos/Evaluation%20Vid.mp4'),
  mimeType: 'video/mp4',
  fileName: 'Evaluation Vid.mp4',
}

export async function sendMediaWithoutBlockingText(
  client: Pick<RespondClient, 'sendAttachmentMessage'>,
  identifier: string,
  attachment: RespondAttachment,
) {
  if (!attachment.url) {
    console.error(`Respond ${attachment.type} was not sent because its public URL is not configured`)
    return false
  }
  try {
    await client.sendAttachmentMessage(identifier, attachment)
    return true
  } catch (error) {
    console.error(`Respond ${attachment.type} delivery failed; continuing with text`, error instanceof Error ? error.message : error)
    return false
  }
}
