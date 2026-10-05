export const clinicConfig = {
  name: 'Dharma Nutrition Clinic',
  treatments: ['Semaglutide', 'Tirzepatide'],
  delivery: {
    method: 'Direct shipping to the customer’s home',
    configuredServiceableStates: ['FL'],
    advertisedStateCount: 43,
    unconfiguredStateMessage:
      'I don’t have verified delivery eligibility for that state yet. A clinic representative will need to confirm it.',
  },
  consultation: {
    durationMinutes: 20,
    format: 'video call analysis',
    priceInCents: 0,
  },
  promotion: {
    firstTreatmentDiscountPercent: 10,
    startingMonthlyPriceInCents: 26_600,
    paymentMethods: ['Affirm', 'Klarna', 'Afterpay', 'CareCredit'],
  },
  scheduling: {
    timezone: 'America/New_York',
    availableSlots: [] as string[],
  },
} as const

export function getStateEligibility(stateCode: string) {
  return clinicConfig.delivery.configuredServiceableStates.includes(stateCode as 'FL')
    ? 'serviceable'
    : 'unknown'
}
