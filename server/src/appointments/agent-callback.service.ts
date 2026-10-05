import { AircallClient, type AircallNumber } from '../integrations/aircall/aircall.client.js'
import { findEligibleUserByHubSpotUserId } from '../integrations/user-mapping/user-mapping.js'

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

function nameMatches(number: AircallNumber, names: readonly string[]) {
  const numberName = normalizeName(number.name)
  return names.some((name) => {
    const normalized = normalizeName(name)
    return numberName === normalized || numberName.includes(normalized) || normalized.includes(numberName)
  })
}

export async function getAgentCallbackNumber(
  hubspotUserId: number | string,
  client: Pick<AircallClient, 'listUserNumbers'> = new AircallClient(),
) {
  const mapping = findEligibleUserByHubSpotUserId(hubspotUserId)
  if (!mapping) throw new Error('The assigned HubSpot user has no eligible Aircall mapping')

  const numbers = await client.listUserNumbers(mapping.aircallUserId)
  const usable = numbers.filter((number) => number.open && number.digits.trim())
  const names = [mapping.canonicalName, ...mapping.aliases]
  const matched = usable.find((number) => nameMatches(number, names))
  const selected = matched ?? (usable.length === 1 ? usable[0] : undefined)
  if (!selected) throw new Error(`No unambiguous open Aircall number found for ${mapping.canonicalName}`)

  return {
    aircallUserId: mapping.aircallUserId,
    aircallNumberId: selected.id,
    digits: selected.digits,
    agentName: mapping.canonicalName,
  }
}
