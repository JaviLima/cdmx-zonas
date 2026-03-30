/**
 * Scraper for Inmuebles24.com
 * Targets rental listings in CDMX.
 *
 * Strategy: fetch listing-index pages and parse the JSON-LD / structured data
 * embedded in each page. Falls back to HTML attribute parsing if JSON-LD is absent.
 *
 * Inmuebles24 embeds listing data in window.__PRELOADED_STATE__ and <script type="application/ld+json">
 */

const BASE_URL = 'https://www.inmuebles24.com'
const SEARCH_URL = `${BASE_URL}/departamentos-en-renta-en-ciudad-de-mexico.html`
const SOURCE = 'inmuebles24'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9',
  'Cache-Control': 'no-cache',
}

export async function scrapeInmuebles24(maxPages = 3) {
  const listings = []

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 ? SEARCH_URL : `${SEARCH_URL}?pagina=${page}`
      const html = await fetchPage(url)
      if (!html) break

      const pageListings = parseListingsFromHTML(html)
      if (pageListings.length === 0) break

      listings.push(...pageListings)
      // Polite delay between pages
      await sleep(800 + Math.random() * 400)
    } catch (err) {
      console.error(`[inmuebles24] page ${page} error:`, err.message)
      break
    }
  }

  return listings
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    console.error(`[inmuebles24] HTTP ${res.status} for ${url}`)
    return null
  }
  return res.text()
}

function parseListingsFromHTML(html) {
  const listings = []

  // Strategy 1: Parse JSON-LD blocks
  const jsonLdMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1])
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'RealEstateListing' || item['@type'] === 'Product') {
          const listing = parseJsonLdItem(item)
          if (listing) listings.push(listing)
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }

  // Strategy 2: Parse __PRELOADED_STATE__ script
  if (listings.length === 0) {
    const stateMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1])
        const results =
          state?.listingSearchResult?.listings ||
          state?.search?.results ||
          []
        for (const item of results) {
          const listing = parseStateItem(item)
          if (listing) listings.push(listing)
        }
      } catch {
        // ignore
      }
    }
  }

  // Strategy 3: Regex fallback on data-id and data-listing-id attributes
  if (listings.length === 0) {
    const cardMatches = html.matchAll(/data-id="(\d+)"[\s\S]*?class="[^"]*posting-title[^"]*"[^>]*>([^<]+)<\/a>/gi)
    for (const m of cardMatches) {
      const id = m[1]
      const title = decodeEntities(m[2].trim())
      listings.push({
        id: `${SOURCE}_${id}`,
        title,
        price: null,
        neighborhood: null,
        size: null,
        bedrooms: null,
        image: null,
        url: `${BASE_URL}/propiedades/${id}`,
        source: SOURCE,
      })
    }
  }

  return listings
}

function parseJsonLdItem(item) {
  const price = item.offers?.price || item.price || null
  const address = item.address || {}
  const neighborhood =
    address.addressLocality ||
    address.neighborhood ||
    address.addressRegion ||
    null

  return {
    id: `${SOURCE}_${item.identifier || item['@id'] || Math.random()}`,
    title: item.name || item.description?.slice(0, 80) || 'Propiedad en renta',
    price: price ? Number(String(price).replace(/[^0-9.]/g, '')) : null,
    neighborhood: neighborhood || null,
    size: extractNumber(item.floorSize?.value || item.floorSize) || null,
    bedrooms: extractNumber(item.numberOfRooms || item.numberOfBedrooms) || null,
    image: item.image?.[0] || item.image || null,
    url: item.url || null,
    source: SOURCE,
  }
}

function parseStateItem(item) {
  const p = item.priceOperationType?.price || item.price || null
  return {
    id: `${SOURCE}_${item.id || item.propertyId || Math.random()}`,
    title: item.title || item.name || 'Propiedad en renta',
    price: p ? Number(String(p).replace(/[^0-9.]/g, '')) : null,
    neighborhood: item.neighborhood || item.location?.neighborhood || null,
    size: item.totalArea || item.coveredArea || null,
    bedrooms: item.rooms?.bedrooms || item.bedrooms || null,
    image: item.photos?.[0]?.url || item.mainPhoto || null,
    url: item.permalink ? `${BASE_URL}${item.permalink}` : null,
    source: SOURCE,
  }
}

function extractNumber(val) {
  if (!val) return null
  const n = Number(String(val).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
