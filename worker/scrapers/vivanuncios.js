/**
 * Vivanuncios.com.mx scraper — OLX Mexico (Next.js SSR)
 *
 * Strategy stack:
 * 1. Parse __NEXT_DATA__ (primary — OLX uses Next.js SSR, data is always present)
 * 2. Parse JSON-LD
 * 3. HTMLRewriter / regex fallback on ad cards
 *
 * OLX listing URL format:
 *   https://www.vivanuncios.com.mx/a-renta-inmuebles/[location]/[title]/[id]
 */

const BASE = 'https://www.vivanuncios.com.mx'
// OLX search URL for renting in CDMX — the numeric suffix is the category/location code
const SEARCH_TPL = `${BASE}/s-renta-inmuebles/ciudad-de-mexico/v1c1001l1149p{page}`
const SOURCE = 'vivanuncios'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function scrapeVivanuncios(maxPages = 5) {
  const all = []
  for (let page = 1; page <= maxPages; page++) {
    const url = SEARCH_TPL.replace('{page}', page)
    try {
      const html = await fetchHTML(url, BASE)
      if (!html) break
      const listings = extractListings(html)
      if (!listings.length) break
      all.push(...listings)
      await sleep(700 + Math.random() * 700)
    } catch (err) {
      console.error(`[vivanuncios] p${page}:`, err.message)
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
  if (!res.ok) { console.error(`[vivanuncios] HTTP ${res.status}`); return null }
  return res.text()
}

function extractListings(html) {
  // Strategy 1: __NEXT_DATA__ (OLX/Vivanuncios runs Next.js SSR)
  const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (ndMatch) {
    try {
      const nd = JSON.parse(ndMatch[1])
      const listings = extractFromNextData(nd)
      if (listings.length) return listings
    } catch {}
  }

  // Strategy 2: JSON-LD
  const jsonLdListings = extractFromJsonLd(html)
  if (jsonLdListings.length) return jsonLdListings

  // Strategy 3: Regex on OLX ad cards
  return extractFromHtml(html)
}

function extractFromNextData(nd) {
  const pp = nd?.props?.pageProps
  // OLX buries ads in several possible locations depending on version
  const candidatePaths = [
    pp?.initialData?.listings,
    pp?.initialData?.adsList,
    pp?.initialData?.ads,
    pp?.adsList,
    pp?.ads,
    pp?.listingData?.listings,
    nd?.props?.initialData?.listings,
    nd?.props?.initialData?.adsList,
  ]
  for (const arr of candidatePaths) {
    if (Array.isArray(arr) && arr.length) {
      return arr.map(mapOlxAd).filter(Boolean)
    }
  }
  // Deep search: look for any array of objects with 'priceValue' or 'subject'
  return deepFindAds(nd)
}

function deepFindAds(obj, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== 'object') return []
  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj[0] && (obj[0].priceValue || obj[0].subject || obj[0].adId)) {
      return obj.map(mapOlxAd).filter(Boolean)
    }
    for (const item of obj) {
      const found = deepFindAds(item, depth + 1)
      if (found.length) return found
    }
  } else {
    for (const val of Object.values(obj)) {
      const found = deepFindAds(val, depth + 1)
      if (found.length) return found
    }
  }
  return []
}

function mapOlxAd(ad) {
  if (!ad) return null
  // Price can be in many formats
  const price =
    ad.priceValue ||
    ad.price?.value ||
    ad.price?.amount ||
    ad.price ||
    null
  const numPrice = price ? Number(String(price).replace(/[^0-9.]/g, '')) : null
  if (!numPrice || numPrice < 1000) return null

  // URL: must be an individual listing page, not the search root
  const rawUrl = ad.url || ad.permalink || ad.adUrl || ''
  const url = rawUrl.startsWith('http') ? rawUrl : rawUrl ? `${BASE}${rawUrl}` : null
  // Reject if it's just the search page root or doesn't look like a listing
  if (!url || url === BASE || url === `${BASE}/`) return null
  if (!url.includes('/a-renta-') && !url.match(/\/\d+$/)) return null

  // Image: JSON-LD image field or OLX images array, then gallery fallback
  const imgs = ad.images || ad.pictures || []
  const rawThumb =
    ad.thumbnail ||
    ad.mainImage ||
    ad.thumbnailUrl ||
    (Array.isArray(imgs) && imgs.length > 0 && (imgs[0]?.url || imgs[0]?.href || imgs[0])) ||
    null

  const loc = ad.location || ad.address || {}
  const neighborhood =
    ad.neighborhoodName ||
    loc.neighbourhood ||
    loc.neighborhood ||
    loc.subLocality ||
    loc.locality ||
    null

  return {
    id: `${SOURCE}_${ad.id || ad.adId || Math.random().toString(36).slice(2)}`,
    title: ad.subject || ad.title || ad.name || 'Propiedad en renta',
    price: numPrice,
    neighborhood: neighborhood || null,
    size: ad.parameters?.size || ad.size || ad.area || null,
    bedrooms: ad.parameters?.rooms || ad.rooms || ad.bedrooms || null,
    image: cleanImageUrl(rawThumb),
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
        if (!['RealEstateListing', 'Product'].includes(item['@type'])) continue
        const price = item.offers?.price || item.price
        const numPrice = price ? Number(String(price).replace(/[^0-9.]/g, '')) : null
        if (!numPrice || numPrice < 1000) continue
        const url = item.url
        if (!url || (!url.includes('vivanuncios') && !url.startsWith('/'))) continue
        const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`
        // Reject if not a listing URL
        if (fullUrl === BASE || fullUrl === `${BASE}/`) continue
        const addr = item.address || {}
        // JSON-LD image field priority
        const rawImage = Array.isArray(item.image) ? item.image[0] : item.image
        listings.push({
          id: `${SOURCE}_ld_${item['@id'] || Math.random().toString(36).slice(2)}`,
          title: item.name || 'Propiedad en renta',
          price: numPrice,
          neighborhood: addr.neighborhood || addr.addressLocality || null,
          size: item.floorSize?.value || null,
          bedrooms: item.numberOfRooms || null,
          image: cleanImageUrl(rawImage),
          url: fullUrl,
          source: SOURCE,
        })
      }
    } catch {}
  }
  return listings
}

function extractFromHtml(html) {
  const listings = []
  const seen = new Set()
  // OLX ad links follow pattern /a-renta-.../...
  const linkMatches = [...html.matchAll(/href="(\/a-renta-[^"]+)"/g)]
  for (const m of linkMatches) {
    const url = `${BASE}${m[1]}`
    if (seen.has(url)) continue
    seen.add(url)
    const idx = html.indexOf(m[0])
    const vicinity = html.slice(Math.max(0, idx - 100), idx + 1000)
    const priceMatch = vicinity.match(/\$\s*([\d,]+)/)
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null
    if (!price || price < 1000) continue

    // Try JSON-LD image, then gallery/data-gallery img, then src with image extension
    let image = null
    const galleryMatch = vicinity.match(/(?:class="[^"]*gallery[^"]*"|data-gallery)[^>]*>[\s\S]*?<img[^>]+src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    if (!image && galleryMatch) image = cleanImageUrl(galleryMatch[1])
    if (!image) {
      const imgMatch = vicinity.match(/src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
      if (imgMatch) image = cleanImageUrl(imgMatch[1])
    }

    const titleMatch = vicinity.match(/data-aut-id="itemTitle"[^>]*>([^<]+)/)
      || vicinity.match(/<h2[^>]*>([^<]+)<\/h2>/)
    listings.push({
      id: `${SOURCE}_html_${seen.size}`,
      title: titleMatch ? titleMatch[1].trim() : 'Propiedad en renta',
      price,
      neighborhood: null,
      size: null,
      bedrooms: null,
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
