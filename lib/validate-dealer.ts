// Utility function to validate dealer NIC numbers

// URL to the dealers JSON file
const DEALERS_JSON_URL = "/data/SAMPLEdealers.json"

// Interface for dealer data
export interface Dealer {
  AREA: string
  "BP CODE": number
  "BP NAME": string
  "OUTLET CODE": string
  "OUTLET NAME": string
  CLASSIFICATION: string
  "DEALER NAME": string
  NICNUMBER: string
  CONTACTNO: number
  "EVENT DATE": string
  HOTEL: string
}

// Interface for the dealers JSON response
interface DealersResponse {
  dealers: Dealer[]
}

// Cache the dealers data to avoid fetching it multiple times
let dealersCache: Dealer[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

/**
 * Fetch dealers data from the JSON file
 */
export async function fetchDealers(): Promise<Dealer[]> {
  const currentTime = Date.now()

  // Return cached data if it's still valid
  if (dealersCache && currentTime - lastFetchTime < CACHE_DURATION) {
    return dealersCache
  }

  try {
    const response = await fetch(DEALERS_JSON_URL)

    if (!response.ok) {
      throw new Error(`Failed to fetch dealers data: ${response.status} ${response.statusText}`)
    }

    const data: DealersResponse = await response.json()
    dealersCache = data.dealers
    lastFetchTime = currentTime

    return dealersCache
  } catch (error) {
    console.error("Error fetching dealers data:", error)
    throw new Error("Failed to fetch dealers data. Please try again later.")
  }
}

/**
 * Validate if a NIC number exists in the dealers list
 */
export async function validateDealerNIC(nic: string): Promise<{ valid: boolean; dealer?: Dealer }> {
  try {
    const dealers = await fetchDealers()

    // Normalize the NIC by removing any spaces and converting to uppercase
    const normalizedNIC = nic.trim().toUpperCase()

    // Find the dealer with the matching NIC
    const dealer = dealers.find((d) => String(d.NICNUMBER).trim().toUpperCase() === normalizedNIC)

    if (dealer) {
      return { valid: true, dealer }
    } else {
      return { valid: false }
    }
  } catch (error) {
    console.error("Error validating dealer NIC:", error)
    throw error
  }
}
