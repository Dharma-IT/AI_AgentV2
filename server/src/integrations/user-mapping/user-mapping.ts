export type CanonicalTeam = 'sales' | 'customer_service' | 'front_desk'

export interface IntegrationUserMapping {
  canonicalName: string
  aliases: readonly string[]
  team: CanonicalTeam
  bookingEligible: boolean
  respondUserId: number
  respondEmail: string
  hubspotUserId: number
  hubspotOwnerId: number
  hubspotEmail: string
  aircallUserId: number
  aircallEmail: string
}

export const INTEGRATION_USER_MAPPINGS: readonly IntegrationUserMapping[] = [
  { canonicalName: 'Alejandra Oyala', aliases: [], team: 'sales', bookingEligible: true, respondUserId: 1206758, respondEmail: 'aoyala@dharmanutritionclinic.com', hubspotUserId: 99223316, hubspotOwnerId: 99223316, hubspotEmail: 'aoyala@dharmanutritionclinic.com', aircallUserId: 2068382, aircallEmail: 'aoyala@dharmanutritionclinic.com' },
  { canonicalName: 'Carlos Vargas', aliases: [], team: 'sales', bookingEligible: true, respondUserId: 76234333, respondEmail: 'cvargas@dharmanutritionclinic.com', hubspotUserId: 100293115, hubspotOwnerId: 100293115, hubspotEmail: 'cvargas@dharmanutritionclinic.com', aircallUserId: 2085034, aircallEmail: 'cvargas@dharmanutritionclinic.com' },
  { canonicalName: 'Yaneth Rodriguez', aliases: [], team: 'sales', bookingEligible: true, respondUserId: 76234311, respondEmail: 'yrodriguez@dharmanutritionclinic.com', hubspotUserId: 100293099, hubspotOwnerId: 100293099, hubspotEmail: 'yrodriguez@dharmanutritionclinic.com', aircallUserId: 2085033, aircallEmail: 'yrodriguez@dharmanutritionclinic.com' },
  { canonicalName: 'Arles Martinez', aliases: [], team: 'customer_service', bookingEligible: true, respondUserId: 483856, respondEmail: 'amartinez@dharmanutritionclinic.com', hubspotUserId: 77394932, hubspotOwnerId: 77394932, hubspotEmail: 'amartinez@dharmanutritionclinic.com', aircallUserId: 1476055, aircallEmail: 'amartinez@dharmanutritionclinic.com' },
  { canonicalName: 'Brayam Zuluaga', aliases: [], team: 'customer_service', bookingEligible: true, respondUserId: 811880, respondEmail: 'bzuluaga@dharmanutritionclinic.com', hubspotUserId: 79527842, hubspotOwnerId: 79527842, hubspotEmail: 'bzuluaga@dharmanutritionclinic.com', aircallUserId: 1568390, aircallEmail: 'bzuluaga@dharmanutritionclinic.com' },
  { canonicalName: 'Edmilson Velasquez', aliases: ['Edmilson Morales'], team: 'customer_service', bookingEligible: true, respondUserId: 446104, respondEmail: 'emorales@dharmanutritionclinic.com', hubspotUserId: 77394941, hubspotOwnerId: 77394941, hubspotEmail: 'emorales@dharmanutritionclinic.com', aircallUserId: 1773091, aircallEmail: 'emorales@dharmanutritionclinic.com' },
  { canonicalName: 'Alice F', aliases: ['Alice', 'Aline', 'Aline Strelow'], team: 'customer_service', bookingEligible: true, respondUserId: 985768, respondEmail: 'alice@dharmanutritionclinic.com', hubspotUserId: 62115861, hubspotOwnerId: 627393184, hubspotEmail: 'astrelow@dharmanutritionclinic.com', aircallUserId: 1375572, aircallEmail: 'alice@dharmanutritionclinic.com' },
  { canonicalName: 'Zara Meza', aliases: [], team: 'customer_service', bookingEligible: true, respondUserId: 1169583, respondEmail: 'zmeza@dharmanutritionclinic.com', hubspotUserId: 96663739, hubspotOwnerId: 96663739, hubspotEmail: 'zmeza@dharmanutritionclinic.com', aircallUserId: 2026682, aircallEmail: 'zmeza@dharmanutritionclinic.com' },
  { canonicalName: 'Laura Sanchez', aliases: ['Laura Alejandra Sanchez Pinto'], team: 'front_desk', bookingEligible: false, respondUserId: 803462, respondEmail: 'lsanchez@dharmanutritionclinic.com', hubspotUserId: 80079886, hubspotOwnerId: 80079886, hubspotEmail: 'lsanchez@dharmanutritionclinic.com', aircallUserId: 1539701, aircallEmail: 'lsanchez@dharmanutritionclinic.com' },
  { canonicalName: 'William Carcamo', aliases: [], team: 'front_desk', bookingEligible: false, respondUserId: 954195, respondEmail: 'wcarcamo@dharmanutritionclinic.com', hubspotUserId: 84785557, hubspotOwnerId: 84785557, hubspotEmail: 'wcarcamo@dharmanutritionclinic.com', aircallUserId: 1767679, aircallEmail: 'wcarcamo@dharmanutritionclinic.com' },
  { canonicalName: 'Belizabett Gonzalez', aliases: [], team: 'front_desk', bookingEligible: false, respondUserId: 1175809, respondEmail: 'bgonzalez@dharmanutritionclinic.com', hubspotUserId: 96947998, hubspotOwnerId: 96947998, hubspotEmail: 'bgonzalez@dharmanutritionclinic.com', aircallUserId: 2030193, aircallEmail: 'bgonzalez@dharmanutritionclinic.com' },
  { canonicalName: 'Ivan Baez', aliases: [], team: 'front_desk', bookingEligible: false, respondUserId: 76222069, respondEmail: 'ibaez@dharmanutritionclinic.com', hubspotUserId: 99308487, hubspotOwnerId: 99308487, hubspotEmail: 'ibaez@dharmanutritionclinic.com', aircallUserId: 2075634, aircallEmail: 'ibaez@dharmanutritionclinic.com' },
] as const

export function findEligibleUserByHubSpotUserId(
  hubspotUserId: number | string,
): IntegrationUserMapping | undefined {
  const normalizedId = Number(hubspotUserId)
  return INTEGRATION_USER_MAPPINGS.find(
    (mapping) => mapping.bookingEligible && mapping.hubspotUserId === normalizedId,
  )
}
