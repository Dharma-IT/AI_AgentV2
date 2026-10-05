const zonesByState: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DC: 'America/New_York',
  DE: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  IA: 'America/Chicago', ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', MA: 'America/New_York',
  MD: 'America/New_York', ME: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MO: 'America/Chicago', MS: 'America/Chicago', MT: 'America/Denver', NC: 'America/New_York',
  ND: 'America/Chicago', NE: 'America/Chicago', NH: 'America/New_York', NJ: 'America/New_York',
  NM: 'America/Denver', NV: 'America/Los_Angeles', NY: 'America/New_York', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VA: 'America/New_York', VT: 'America/New_York', WA: 'America/Los_Angeles',
  WI: 'America/Chicago', WV: 'America/New_York', WY: 'America/Denver',
}

const cityZoneOverrides: Record<string, string> = {
  chicago: 'America/Chicago', denver: 'America/Denver', honolulu: 'Pacific/Honolulu',
  las_vegas: 'America/Los_Angeles', los_angeles: 'America/Los_Angeles', miami: 'America/New_York',
  new_york: 'America/New_York', phoenix: 'America/Phoenix', salt_lake_city: 'America/Denver',
  seattle: 'America/Los_Angeles', anchorage: 'America/Anchorage',
}

function cityKey(city?: string | null) {
  return city?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') ?? ''
}

export function resolveCustomerTimezone(stateCode: string, city?: string | null) {
  return cityZoneOverrides[cityKey(city)] ?? zonesByState[stateCode.toUpperCase()] ?? 'America/New_York'
}

export function customerTimezoneLabel(timezone: string, city?: string | null) {
  if (city) return `${city.split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')} Time`
  const labels: Record<string, string> = {
    'America/New_York': 'Eastern Time', 'America/Chicago': 'Central Time',
    'America/Denver': 'Mountain Time', 'America/Los_Angeles': 'Pacific Time',
    'America/Phoenix': 'Arizona Time', 'America/Anchorage': 'Alaska Time',
    'Pacific/Honolulu': 'Hawaii Time',
  }
  return labels[timezone] ?? timezone
}
