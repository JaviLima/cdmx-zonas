/**
 * Lamudi.com.mx scraper
 *
 * Strategy stack:
 * 1. Parse JSON-LD ItemList (Lamudi server-renders structured data)
 * 2. Parse window.__INITIAL_STATE__ or similar embedded JSON
 * 3. HTMLRewriter / regex on listing article cards
 *
 * Lamudi listing URL format:
 *   https://www.lamudi.com.mx/[slug]-[id].html
 */

const BASE = 'https://www.lamudi.com.mx'
const SEARCH = `${BASE}/ciudad-de-mexico/for-rent/`
const SOURCE = 'lamudi'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function scrapeLamudi(maxPages = 5) {
  const all = []
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? SEARCH : `${SEARCH}?page=${page}`
    try {
      const html = await fetchHTML(url, BASE)
      if (!html) break
      const listings = extractListings(html)
      if (!listings.length) break
      all.push(...listings)
      await sleep(500 + Math.random() * 800)
    } catch (err) {
      console.error(`[lamudi] p${page}:`, err.message)
      break
    }
  }
  return all
}

async function fetchHTML(url, referer) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.7',
      Referer: referer,
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  })
  if (!res.ok) { console.error(`[lamudi] HTTP ${res.status}`); return null }
  return res.text()
}

function extractListings(html) {
  // Strategy 1: JSON-LD
  const fromJsonLd = extractFromJsonLd(html)
  if (fromJsonLd.length) return fromJsonLd

  // Strategy 2: window.__INITIAL_STATE__ patterns
  const statePatterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
    /window\.pageData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  ]
  for (const pat of statePatterns) {
    const m = html.match(pat)
    if (m) {
      try {
        const data = JSON.parse(m[1])
        const listings = extractFromStateObject(data)
        if (listings.length) return listings
      } catch {}
    }
  }

  // Strategy 3: __NEXT_DATA__
  const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (ndMatch) {
    try {
      const nd = JSON.parse(ndMatch[1])
      const listings = extractFromNextData(nd)
      if (listings.length) return listings
    } catch {}
  }

  // Strategy 4: data-listing JSON attributes
  const dataListings = extractFromDataAttributes(html)
  if (dataListings.length) return dataListings

  // Strategy 5: regex on article/listing card markup
  return extractFromHtml(html)
}

function extractFromJsonLd(html) {
  const listings = []
  const matches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const m of matches) {
    try {
      const data = JSON.parse(m[1])
      // Handle ItemList
      if (data['@type'] === 'ItemList') {
        for (const el of (data.itemListElement || [])) {
          const item = el.item || el
          const listing = mapJsonLdItem(item)
          if (listing) listings.push(listing)
        }
      } else if (data['@type'] === 'RealEstateListing') {
        const listing = mapJsonLdItem(data)
        if (listing) listings.push(listing)
      }
    } catch {}
  }
  return listings
}

function mapJsonLdItem(item) {
  if (!item) return null
  const price = item.offers?.price || item.price
  const numPrice = price ? Number(String(price).replace(/[^0-9.]/g, '')) : null
  if (!numPrice || numPrice < 1000) return null
  const url = item.url
  if (!url) return null
  const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`
  // Must look like a property listing
  if (!fullUrl.includes('lamudi') || !fullUrl.endsWith('.html')) return null
  const addr = item.address || {}

  // JSON-LD image field priority, then .listing-thumbnails img fallback
  const imgs = Array.isArray(item.image) ? item.image : item.image ? [item.image] : []
  let image = cleanImageUrl(imgs[0] || null)
  if (!image) image = extractThumbnailsImage(null) // will be null without html context

  return {
    id: `${SOURCE}_ld_${item['@id'] || item.identifier || Math.random().toString(36).slice(2)}`,
    title: item.name || 'Propiedad en renta',
    price: numPrice,
    neighborhood: addr.neighborhood || addr.addressLocality || addr.sublocality || null,
    size: item.floorSize?.value || item.lotSize?.value || null,
    bedrooms: item.numberOfRooms || item.numberOfBedrooms || null,
    image,
    url: fullUrl,
    source: SOURCE,
  }
}

function extractThumbnailsImage(vicinity) {
  if (!vicinity) return null
  const m = vicinity.match(/class="[^"]*listing-thumbnails[^"]*"[^>]*>[\s\S]*?<img[^>]+src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
  return m ? cleanImageUrl(m[1]) : null
}

function extractFromStateObject(state) {
  const candidates = [
    state?.listings?.items,
    state?.listing?.items,
    state?.searchResults?.listings,
    state?.results,
  ]
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) {
      return arr.map(mapLamudiItem).filter(Boolean)
    }
  }
  return []
}

function extractFromNextData(nd) {
  const pp = nd?.props?.pageProps
  const candidates = [pp?.listings, pp?.searchResults, pp?.initialData?.listings]
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) {
      return arr.map(mapLamudiItem).filter(Boolean)
    }
  }
  return []
}

function mapLamudiItem(item) {
  if (!item) return null
  const price = item.price || item.priceRaw || item.attributes?.price
  const numPrice = price ? Number(String(price).replace(/[^0-9.]/g, '')) : null
  if (!numPrice || numPrice < 1000) return null
  const rawUrl = item.url || item.permalink || item.link || ''
  const url = rawUrl.startsWith('http') ? rawUrl : rawUrl ? `${BASE}${rawUrl}` : null
  if (!url) return null
  const imgs = item.images || item.photos || []
  return {
    id: `${SOURCE}_${item.id || item.listingId || Math.random().toString(36).slice(2)}`,
    title: item.title || item.name || 'Propiedad en renta',
    price: numPrice,
    neighborhood: item.location?.district || item.location?.neighborhood || item.neighborhood || null,
    size: item.attributes?.lot_size || item.attributes?.floor_size || item.size || null,
    bedrooms: item.attributes?.bedrooms || item.bedrooms || null,
    image: cleanImageUrl((Array.isArray(imgs) && imgs.length > 0) ? (imgs[0]?.url || imgs[0]) : item.thumbnail || null),
    url,
    source: SOURCE,
  }
}

function extractFromDataAttributes(html) {
  const listings = []
  const matches = [...html.matchAll(/data-listing="([^"]+)"/g)]
  for (const m of matches) {
    try {
      const item = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'"))
      const listing = mapLamudiItem(item)
      if (listing) listings.push(listing)
    } catch {}
  }
  return listings
}

function extractFromHtml(html) {
  const listings = []
  const seen = new Set()
  // Lamudi listing URLs end in .html and contain a numeric ID
  const linkMatches = [...html.matchAll(/href="(https?:\/\/www\.lamudi\.com\.mx\/[^"]+\.html)"/g)]
  for (const m of linkMatches) {
    const url = m[1]
    if (seen.has(url) || url === `${BASE}/`) continue
    // Must look like a property listing (has a slug + id pattern)
    if (!/\d/.test(url.replace(BASE, ''))) continue
    seen.add(url)
    const idx = html.indexOf(m[0])
    const vicinity = html.slice(Math.max(0, idx - 200), idx + 1200)
    const priceMatch =
      vicinity.match(/data-price="([\d,]+)"/) ||
      vicinity.match(/\$\s*([\d,]+)/)
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null
    if (!price || price < 1000) continue

    // Try .listing-thumbnails first img, then any src with image extension
    let image = extractThumbnailsImage(vicinity)
    if (!image) {
      const imgMatch = vicinity.match(/(?:src|data-src)="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
      if (imgMatch) image = cleanImageUrl(imgMatch[1])
    }

    const titleMatch =
      vicinity.match(/class="[^"]*listing-name[^"]*"[^>]*>([^<]+)</) ||
      vicinity.match(/<h2[^>]*>([^<]+)<\/h2>/) ||
      vicinity.match(/<h3[^>]*>([^<]+)<\/h3>/)
    const neighborhoodMatch = vicinity.match(/class="[^"]*listing-location[^"]*"[^>]*>([^<]+)</)
    const sizeMatch = vicinity.match(/([\d.]+)\s*m²/)
    const bedroomsMatch = vicinity.match(/([\d]+)\s*(?:recámara|hab\b|cuarto)/i)
    listings.push({
      id: `${SOURCE}_html_${seen.size}`,
      title: titleMatch ? titleMatch[1].trim() : 'Propiedad en renta',
      price,
      neighborhood: neighborhoodMatch ? neighborhoodMatch[1].trim() : null,
      size: sizeMatch ? Number(sizeMatch[1]) : null,
      bedrooms: bedroomsMatch ? Number(bedroomsMatch[1]) : null,
      image,
      url,
      source: SOURCE,
    })
  }
  return listings
}

function cleanImageUrl(url) {
  if (!url || typeof url !== 'string') return null
  if (!url.startsWith('https://')) return null
  const lower = url.toLowerCase()
  if (
    lower.includes('placeholder') ||
    lower.includes('default') ||
    lower.includes('no-image') ||
    lower.includes('logo') ||
    lower.includes('blank') ||
    lower.startsWith('data:')
  ) return null
  return url
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
