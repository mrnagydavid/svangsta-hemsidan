import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const CHURCH_API_URL =
  'https://svk-apim-prod.azure-api.net/calendar/v1/event/search/'
const CHURCH_API_KEY = 'f6937363a4d94012a78a32442752cf5c'
const CHURCH_OWNER_ID = '22059'
const CHURCH_PLACE_API_URL = 'https://api.svenskakyrkan.se/platser/v4/place'
const CHURCH_PLACE_API_KEY = '09ec36d9-df57-49f6-b9b1-51be61370e62'
const GARDEN_URL = 'https://svangstatradgard.se/index.php/category/evenemang/'
const OUTPUT_FILE = path.join(__dirname, '../src/events.json')

// Cache for place details to avoid duplicate API calls
const placeCache = new Map()

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting event fetch...\n')

    // Read existing events file (for caching PRO descriptions and preserving past events)
    let existingEvents = []
    if (fs.existsSync(OUTPUT_FILE)) {
      const existingData = fs.readFileSync(OUTPUT_FILE, 'utf-8')
      existingEvents = JSON.parse(existingData)
      console.log(`Found ${existingEvents.length} existing events\n`)
    }

    // Separate existing events by source
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Keep past events (history)
    const pastEvents = existingEvents.filter((event) => {
      const eventDate = new Date(event.startDate)
      return eventDate < today
    })

    // Keep existing events from other sources (e.g., manually curated PRO events)
    // These are events that aren't from church or garden
    const otherSourceEvents = existingEvents.filter((event) => {
      const eventDate = new Date(event.startDate)
      return (
        eventDate >= today &&
        !event.id.startsWith('church-') &&
        !event.id.startsWith('garden-')
      )
    })

    console.log(`Preserving ${pastEvents.length} past events`)
    console.log(
      `Preserving ${otherSourceEvents.length} events from other sources (e.g., PRO)\n`,
    )

    // Fetch from church and garden sources (only future events)
    const [churchEvents, gardenEvents] = await Promise.all([
      fetchChurchEvents().catch((err) => {
        console.error('Failed to fetch church events:', err.message)
        return []
      }),
      fetchGardenEvents().catch((err) => {
        console.error('Failed to fetch garden events:', err.message)
        return []
      }),
    ])

    // Transform to match existing format (only future events)
    const transformedChurch = await transformChurchEvents(churchEvents)
    const transformedGarden = transformGardenEvents(gardenEvents)

    // Combine all events and sort by date
    const allEvents = [
      ...pastEvents,
      ...otherSourceEvents,
      ...transformedChurch,
      ...transformedGarden,
    ].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write to file (simple array format to match existing structure)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allEvents, null, 2) + '\n')

    console.log(
      `\n✓ Successfully wrote ${allEvents.length} events to ${OUTPUT_FILE}`,
    )
    console.log(`  - Church events: ${transformedChurch.length}`)
    console.log(`  - Garden events: ${transformedGarden.length}`)
    console.log(`  - Other sources (preserved): ${otherSourceEvents.length}`)
  } catch (error) {
    console.error('Error fetching events:', error)
    process.exit(1)
  }
}

/** ============================================================================
 * CHURCH FUNCTIONS (Svensk Kyrkan)
 * ============================================================================ */

/**
 * Fetch church events from Swedish Church API
 */
async function fetchChurchEvents() {
  console.log('Fetching church events...')

  // Fetch events from today onwards
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Start of today
  const fromDate = today.toISOString()

  const response = await fetch(CHURCH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Ocp-Apim-Subscription-Key': CHURCH_API_KEY,
    },
    body: `access=external&expand=place%2Cowner&owner_id=${CHURCH_OWNER_ID}&from=${encodeURIComponent(fromDate)}`,
  })

  if (!response.ok) {
    throw new Error(
      `Church API error: ${response.status} ${response.statusText}`,
    )
  }

  const data = await response.json()
  console.log(`✓ Fetched ${data.result?.length || 0} church events`)

  return data.result || []
}

/**
 * Transform church events to match existing format
 * Fetches address for each unique place from the Church Places API (with caching)
 */
async function transformChurchEvents(events) {
  console.log('Fetching addresses for church events...')

  // First, collect all unique place IDs
  const placeIds = new Set()
  events.forEach((event) => {
    if (event.place?.id) {
      placeIds.add(event.place.id)
    }
  })

  // Fetch place details for all unique places
  console.log(`  Fetching details for ${placeIds.size} unique places...`)
  for (const placeId of placeIds) {
    await fetchPlaceDetails(placeId)
    // Small delay between place API calls
    await delay(200)
  }

  // Filter for future events
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Now transform events using cached place data
  const transformedEvents = events
    .map((event) => {
      let description = event.description || ''

      // Add address if available from cache
      if (event.place?.id) {
        const address = placeCache.get(event.place.id)
        if (address) {
          description = description
            ? `${description}\n\nAdress: ${address}`
            : `Adress: ${address}`
        }
      }

      // Convert church API timestamps to naive datetime strings
      // The API returns ISO timestamps which we convert to local naive datetime
      const startDate = convertToNaiveDatetime(event.start)
      const endDate = convertToNaiveDatetime(event.end)

      return {
        id: `church-${event.id}`,
        title: event.title,
        startDate: startDate,
        endDate: endDate,
        location: event.place?.name || 'Svängsta kyrka',
        description: description,
        organizer: 'Svängsta kyrka',
        organizerLink: 'https://www.svenskakyrkan.se/asarum-ringamala',
        link: `https://www.svenskakyrkan.se/kalender?eventId=${event.id}`,
        forMembersOnly: false,
      }
    })
    .filter((event) => {
      // Only include events that are in the future
      const eventDate = new Date(event.startDate)
      return eventDate >= today
    })

  console.log(
    `✓ Processed ${transformedEvents.length} church events with addresses`,
  )
  return transformedEvents.sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate),
  )
}

/**
 * Fetch place details including address from Church Places API
 */
async function fetchPlaceDetails(placeId) {
  // Check cache first
  if (placeCache.has(placeId)) {
    return placeCache.get(placeId)
  }

  try {
    const url = `${CHURCH_PLACE_API_URL}?apikey=${CHURCH_PLACE_API_KEY}&id=${placeId}&limit=1&offset=0`
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`Failed to fetch place ${placeId}: ${response.statusText}`)
      return null
    }

    const data = await response.json()

    // Extract address from the first result
    const place = data.result?.[0]
    let address = null

    if (place?.address) {
      // Combine address components into a single string
      const parts = []
      if (place.address.street) parts.push(place.address.street)
      if (place.address.zipCode && place.address.city) {
        parts.push(`${place.address.zipCode} ${place.address.city}`)
      } else if (place.address.city) {
        parts.push(place.address.city)
      }
      address = parts.length > 0 ? parts.join(', ') : null
    }

    // Cache the result
    placeCache.set(placeId, address)
    return address
  } catch (error) {
    console.error(
      `Failed to fetch place details for ${placeId}:`,
      error.message,
    )
    return null
  }
}

/** ============================================================================
 * GARDEN SOCIETY FUNCTIONS (Trädgårdsföreningen)
 * ============================================================================ */

/**
 * Fetch and parse garden society events from HTML
 */
async function fetchGardenEvents() {
  console.log('Fetching garden society events...')

  const response = await fetch(GARDEN_URL)

  if (!response.ok) {
    throw new Error(
      `Garden URL error: ${response.status} ${response.statusText}`,
    )
  }

  const html = await response.text()
  const $ = cheerio.load(html)
  const events = []

  // Parse list items from the article list
  $('ol.article-list li').each((_, elem) => {
    const $li = $(elem)
    const title = $li.find('h2 a').first().text().trim()
    const content = $li.find('p').text().trim()
    const dateText = $li.find('.meta .date').first().text().trim()
    const link = $li.find('h2 a').first().attr('href')

    if (title) {
      events.push({
        title,
        content,
        dateText,
        link,
        rawHtml: $li.html(),
      })
    }
  })

  console.log(`✓ Fetched ${events.length} garden society events`)
  return events
}

/**
 * Transform garden events to match existing format
 */
function transformGardenEvents(events) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return events
    .map((event, index) => {
      // Try to parse date from dateText
      let startDate = null
      let endDate = null

      // Attempt to extract date and time
      // Date format in HTML is: "juni 19, 2025" (month day, year)
      const dateMatch = event.dateText.match(
        /(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{1,2}),?\s+(\d{4})?/i,
      )
      const timeMatch = event.content.match(/kl[.\s]*(\d{1,2})[.:,](\d{2})/i)

      if (dateMatch) {
        const monthMap = {
          januari: 0,
          februari: 1,
          mars: 2,
          april: 3,
          maj: 4,
          juni: 5,
          juli: 6,
          augusti: 7,
          september: 8,
          oktober: 9,
          november: 10,
          december: 11,
        }
        const month = monthMap[dateMatch[1].toLowerCase()]
        const day = parseInt(dateMatch[2])
        const year = dateMatch[3]
          ? parseInt(dateMatch[3])
          : new Date().getFullYear()

        if (timeMatch) {
          const hour = parseInt(timeMatch[1])
          const minute = parseInt(timeMatch[2])
          // Store as naive datetime string with time
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
          endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour + 2).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        } else {
          // Store as naive date string without time
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
      }

      // Extract a meaningful ID from the link
      let eventId = index
      if (event.link) {
        const parts = event.link.split('/').filter((part) => part.length > 0)
        eventId = parts[parts.length - 1] || index
      }

      return {
        id: `garden-${eventId}`,
        title: event.title,
        startDate: startDate,
        endDate: endDate,
        location: 'Svängsta',
        description: event.content.substring(0, 300).trim(), // Truncate long content
        organizer: 'Svängsta Trädgårdsförening',
        organizerLink: 'https://svangstatradgard.se',
        link:
          event.link ||
          'https://svangstatradgard.se/index.php/category/evenemang/',
        forMembersOnly: false,
      }
    })
    .filter((event) => {
      // Only include events with a valid date that are in the future
      if (event.startDate === null) return false
      const eventDate = new Date(event.startDate)
      return eventDate >= today
    })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
}

/** ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================ */

/**
 * Helper function to add delay between requests
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Convert ISO timestamp to naive datetime string (without timezone)
 * Extracts date/time components directly from the string to avoid timezone conversion.
 * Assumes the timestamp represents Swedish local time.
 * For events at midnight (00:00), returns just the date: "2025-06-12"
 * For events with time, returns date + time: "2025-06-12T18:00"
 */
function convertToNaiveDatetime(isoString) {
  // Parse ISO string to extract date and time components
  // Handles formats like: 2025-06-12T18:00:00Z, 2025-06-12T18:00:00+02:00, 2025-06-12T18:00:00
  const match = isoString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
  )

  if (!match) {
    // Try to extract just the date
    const dateMatch = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return dateMatch
      ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      : isoString
  }

  const [, year, month, day, hours, minutes] = match

  // Check if the time is midnight (00:00) - treat as date-only event
  if (hours === '00' && minutes === '00') {
    return `${year}-${month}-${day}`
  }

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

main()
