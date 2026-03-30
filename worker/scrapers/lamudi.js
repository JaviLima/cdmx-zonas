/**
 * Scraper for Lamudi.com.mx
 * Targets mid and high-end rental listings in CDMX.
 *
 * Lamudi uses a standard HTML listing grid and often embeds structured data
 * as JSON-LD or in data attributes on listing cards.
 */

const BASE_URL = 'https://www.lamudi.com.mx'
const SEARCH_URL = `${BASE_URL}/ciudad-de-mexico/for-rent/`
const SOURCE = 'lamudi'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9',
}

export async function scrapeLamudi(maxPages = 3) {
  const listings = []

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1 ? SEARCH_URL : `${SEARCH_URL}?page=${page}`
      const html = await fetchPage(url)
      if (!html) break

      const pageListings = parseListingsFromHTML(html)
      if (pageListings.length === 0) break

      listings.push(...pageListings)
      await sleep(700 + Math.random() * 600)
    } catch (err) {
      console.error(`[lamudi] page ${page} error:`, err.message)
      break
    }
  }

  return listings
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    console.error(`[lamudi] HTTP ${res.status} for ${url}`)
    return null
  }
  return res.text()
}

function parseListingsFromHTML(html) {
  const listings = []

  // Strategy 1: JSON-LD
  const jsonLdMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of jsonLdMatches) {
    try {
      const data = JSON.parse(match[1])
      if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
        for (const el of data.itemListElement) {
          const item = el.item || el
          const listing = parseJsonLdItem(item)
          if (listing) listings.push(listing)
        }
      } else if (data['@type'] === 'RealEstateListing') {
        const listing = parseJsonLdItem(data)
        if (listing) listings.push(listing)
      }
    } catch {
      // ignore
    }
  }

  // Strategy 2: data-listing attribute on cards
  if (listings.length === 0) {
    const dataListingMatches = html.matchAll(/data-listing="([^"]+)"/gi)
    for (const m of dataListingMatches) {
      try {
        const item = JSON.parse(m[1].replace(/&quot;/g, '"'))
        const listing = parseDataAttrItem(item)
        if (listing) listings.push(listing)
      } catch {
        // ignore
      }
    }
  }

  // Strategy 3: Regex price + title fallback
  if (listings.length === 0) {
    const blocks = html.split('ListingCell-agent-title')
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i]
      const priceMatch = block.match(/\$\s*([\d,]+)/)
      const titleMatch = block.match(/title="([^"]+)"/)
      const urlMatch = block.match(/href="(\/[^"]+)"/)
      const sizeMatch = block.match(/([\d.]+)\s*m²/)
      const bedroomsMatch = block.match(/([\d]+)\s*(?:recámara|habitación|cuarto)/i)

      if (priceMatch) {
        listings.push({
          id: `${SOURCE}_${i}_${Date.now()}`,
          title: titleMatch ? decodeEntities(titleMatch[1]) : 'Propiedad en renta',
          price: Number(priceMatch[1].replace(/,/g, '')),
          neighborhood: null,
          size: sizeMatch ? Number(sizeMatch[1]) : null,
          bedrooms: bedroomsMatch ? Number(bedroomsMatch[1]) : null,
          image: null,
          url: urlMatch ? `${BASE_URL}${urlMatch[1]}` : null,
          source: SOURCE,
        })
      }
    }
  }

  return listings
}

function parseJsonLdItem(item) {
  const address = item.address || {}
  const neighborhood =
    address.addressLocality ||
    address.neighborhood ||
    address.sublocality ||
    null

  const price = item.offers?.price || item.price || null

  return {
    id: `${SOURCE}_${item['@id'] || item.identifier || Math.random()}`,
    title: item.name || item.description?.slice(0, 80) || 'Propiedad en renta',
    price: price ? Number(String(price).replace(/[^0-9.]/g, '')) : null,
    neighborhood: neighborhood || null,
    size: item.floorSize?.value || item.lotSize?.value || null,
    bedrooms: item.numberOfRooms || item.numberOfBedrooms || null,
    image: Array.isArray(item.image) ? item.image[0] : item.image || null,
    url: item.url || null,
    source: SOURCE,
  }
}

function parseDataAttrItem(item) {
  return {
    id: `${SOURCE}_${item.id || item.listing_id || Math.random()}`,
    title: item.title || item.name || 'Propiedad en renta',
    price: item.price ? Number(String(item.price).replace(/[^0-9.]/g, '')) : null,
    neighborhood: item.location?.district || item.neighborhood || null,
    size: item.attributes?.lot_size || item.attributes?.floor_size || null,
    bedrooms: item.attributes?.bedrooms || item.rooms || null,
    image: item.thumbnail || item.image || null,
    url: item.permalink ? `${BASE_URL}${item.permalink}` : null,
    source: SOURCE,
  }
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
