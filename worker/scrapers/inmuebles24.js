/**
 * Inmuebles24 scraper — NAVENT platform
 *
 * Strategy stack (tries each in order until listings are found):
 * 1. Parse window.__INITIAL_STATE__ / window.initialSearchStore embedded JSON
 * 2. Parse <script id="__NEXT_DATA__"> (newer versions use Next.js)
 * 3. Parse JSON-LD blocks
 * 4. HTMLRewriter on listing card elements
 */

const BASE = 'https://www.inmuebles24.com'
const SEARCH = `${BASE}/departamentos-en-renta-en-ciudad-de-mexico.html`
const SOURCE = 'inmuebles24'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function scrapeInmuebles24(maxPages = 5) {
  const all = []
  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1 ? SEARCH : `${SEARCH}?pagina=${page}`
    try {
      const html = await fetchHTML(url, BASE)
      if (!html) break
      const listings = await extractListings(html)
      if (!listings.length) break
      all.push(...listings)
      await sleep(600 + Math.random() * 600)
    } catch (err) {
      console.error(`[inmuebles24] p${page}:`, err.message)
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
      'Accept-Encoding': 'gzip, deflate, br',
      Referer: referer,
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  })
  if (!res.ok) { console.error(`[inmuebles24] HTTP ${res.status}`); return null }
  return res.text()
}

async function extractListings(html) {
  // Strategy 1: window.__INITIAL_STATE__ or similar NAVENT patterns
  const statePatterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/,
    /window\.initialSearchStore\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/,
    /window\.__SEARCH_RESULTS__\s*=\s*(\[[\s\S]*?\]);\s*(?:window|<\/script>)/,
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

  // Strategy 2: __NEXT_DATA__
  const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextMatch) {
    try {
      const nd = JSON.parse(nextMatch[1])
      const listings = extractFromNextData(nd)
      if (listings.length) return listings
    } catch {}
  }

  // Strategy 3: JSON-LD ItemList or individual RealEstateListing
  const jsonLdListings = extractFromJsonLd(html)
  if (jsonLdListings.length) return jsonLdListings

  // Strategy 4: HTMLRewriter — extract listing card anchors + prices
  return extractWithRewriter(html)
}

function extractFromStateObject(state) {
  const candidates = [
    state?.listingSearchResult?.listings,
    state?.search?.results,
    state?.listings,
    state?.postings,
  ]
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) {
      return arr.map(mapNaventItem).filter(Boolean)
    }
  }
  return []
}

function extractFromNextData(nd) {
  const pp = nd?.props?.pageProps
  const candidates = [
    pp?.initialData?.listings,
    pp?.listings,
    pp?.searchResults,
    pp?.results,
    nd?.props?.initialData?.listings,
  ]
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length) {
      return arr.map(mapNaventItem).filter(Boolean)
    }
  }
  return []
}

function mapNaventItem(item) {
  if (!item) return null
  const price =
    item.priceOperationType?.price?.amount ||
    item.priceOperationType?.price ||
    item.price?.amount ||
    item.price ||
    null

  const numPrice = price ? Number(String(price).replace(/[^0-9.]/g, '')) : null
  if (!numPrice || numPrice < 1000) return null

  const permalink = item.permalink || item.url || ''
  const url = permalink.startsWith('http') ? permalink : permalink ? `${BASE}${permalink}` : null
  if (!url || url === BASE || url === `${BASE}/`) return null

  const images = item.photos || item.images || []
  const image =
    (Array.isArray(images) && images.length > 0)
      ? (images[0]?.url || images[0]?.href || images[0])
      : item.mainPhoto || item.thumbnail || null

  const loc = item.location || item.address || {}
  const neighborhood =
    item.neighborhood ||
    loc.neighborhood ||
    loc.subLocality ||
    loc.addressLocality ||
    null

  return {
    id: `${SOURCE}_${item.id || item.propertyId || Math.random().toString(36).slice(2)}`,
    title: item.title || item.name || 'Propiedad en renta',
    price: numPrice,
    neighborhood: neighborhood || null,
    size: item.totalArea || item.coveredArea || item.floorSize || null,
    bedrooms: item.rooms?.bedrooms ?? item.bedrooms ?? item.numberOfBedrooms ?? null,
    image: cleanImageUrl(image),
    url,
    source: SOURCE,
  }
}

function extractFromJsonLd(html) {
  const listings = []
  const matches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const m of matches) {
    try {
      const data = JSON.parse(m[1])
      const items = data['@type'] === 'ItemList'
        ? (data.itemListElement || []).map((el) => el.item || el)
        : [data]
      for (const item of items) {
        if (!['RealEstateListing', 'Product', 'Offer'].includes(item['@type'])) continue
        const price = item.offers?.price || item.price
        const numPrice = price ? Number(String(price).replace(/[^0-9.]/g, '')) : null
        if (!numPrice || numPrice < 1000) continue
        const url = item.url
        if (!url || !url.includes(BASE.replace('https://', ''))) continue
        const addr = item.address || {}
        listings.push({
          id: `${SOURCE}_ld_${item.identifier || item['@id'] || Math.random().toString(36).slice(2)}`,
          title: item.name || 'Propiedad en renta',
          price: numPrice,
          neighborhood: addr.neighborhood || addr.addressLocality || null,
          size: item.floorSize?.value || null,
          bedrooms: item.numberOfRooms || item.numberOfBedrooms || null,
          image: cleanImageUrl(Array.isArray(item.image) ? item.image[0] : item.image),
          url,
          source: SOURCE,
        })
      }
    } catch {}
  }
  return listings
}

async function extractWithRewriter(html) {
  const listings = []
  const seen = new Set()

  class CardHandler {
    constructor() { this.href = null; this.price = null; this.img = null; this.title = null }
    element(el) {
      const href = el.getAttribute('href')
      if (href && href.includes('/propiedades/')) {
        this.href = href.startsWith('http') ? href : `${BASE}${href}`
      }
    }
  }

  // Fast regex fallback for listing URLs and prices
  const hrefMatches = [...html.matchAll(/href="(\/propiedades\/[^"]+\.html)"/g)]
  for (const m of hrefMatches) {
    const url = `${BASE}${m[1]}`
    if (seen.has(url)) continue
    seen.add(url)
    // Try to find price near this reference
    const idx = html.indexOf(m[0])
    const vicinity = html.slice(Math.max(0, idx - 200), idx + 800)
    const priceMatch = vicinity.match(/\$\s*([\d,]+)/)
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null
    if (!price || price < 1000) continue
    const imgMatch = vicinity.match(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    const titleMatch = vicinity.match(/class="[^"]*posting-title[^"]*"[^>]*>([^<]+)</)
    listings.push({
      id: `${SOURCE}_card_${seen.size}`,
      title: titleMatch ? titleMatch[1].trim() : 'Propiedad en renta',
      price,
      neighborhood: null,
      size: null,
      bedrooms: null,
      image: imgMatch ? imgMatch[1] : null,
      url,
      source: SOURCE,
    })
  }
  return listings
}

function cleanImageUrl(url) {
  if (!url || typeof url !== 'string') return null
  if (!url.startsWith('http')) return null
  // Remove lazy-load placeholders
  if (url.includes('placeholder') || url.includes('blank.gif') || url.includes('data:image')) return null
  return url
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
