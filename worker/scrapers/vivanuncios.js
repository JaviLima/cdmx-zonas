/**
 * Scraper for Vivanuncios.com.mx
 * Targets rental apartments/houses in CDMX.
 *
 * Vivanuncios embeds listing data as JSON inside a <script> tag with
 * id="__NEXT_DATA__" (Next.js SSR) or as JSON-LD blocks.
 */

const BASE_URL = 'https://www.vivanuncios.com.mx'
const SEARCH_URL = `${BASE_URL}/s-renta-inmuebles/ciudad-de-mexico/v1c1001l1149p{page}`
const SOURCE = 'vivanuncios'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9',
}

export async function scrapeVivanuncios(maxPages = 3) {
  const listings = []

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = SEARCH_URL.replace('{page}', page)
      const html = await fetchPage(url)
      if (!html) break

      const pageListings = parseListingsFromHTML(html)
      if (pageListings.length === 0) break

      listings.push(...pageListings)
      await sleep(900 + Math.random() * 500)
    } catch (err) {
      console.error(`[vivanuncios] page ${page} error:`, err.message)
      break
    }
  }

  return listings
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    console.error(`[vivanuncios] HTTP ${res.status} for ${url}`)
    return null
  }
  return res.text()
}

function parseListingsFromHTML(html) {
  const listings = []

  // Strategy 1: Next.js __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      const ads =
        nextData?.props?.pageProps?.ads ||
        nextData?.props?.pageProps?.listings ||
        nextData?.props?.pageProps?.initialData?.listings ||
        []
      for (const ad of ads) {
        const listing = parseNextDataAd(ad)
        if (listing) listings.push(listing)
      }
    } catch {
      // ignore
    }
  }

  // Strategy 2: JSON-LD
  if (listings.length === 0) {
    const jsonLdMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          if (
            item['@type'] === 'RealEstateListing' ||
            item['@type'] === 'Offer' ||
            item['@type'] === 'Product'
          ) {
            const listing = parseJsonLdItem(item)
            if (listing) listings.push(listing)
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Strategy 3: Regex on ad cards
  if (listings.length === 0) {
    const priceMatches = html.matchAll(/data-ad-id="(\d+)"[\s\S]*?\$([\d,]+)[\s\S]*?<\/div>/gi)
    for (const m of priceMatches) {
      listings.push({
        id: `${SOURCE}_${m[1]}`,
        title: 'Propiedad en renta',
        price: Number(m[2].replace(/,/g, '')),
        neighborhood: null,
        size: null,
        bedrooms: null,
        image: null,
        url: `${BASE_URL}/v-inmuebles/${m[1]}`,
        source: SOURCE,
      })
    }
  }

  return listings
}

function parseNextDataAd(ad) {
  const price =
    ad.price?.amount ||
    ad.priceValue ||
    ad.price ||
    null

  const location = ad.location || ad.address || {}
  const neighborhood =
    location.neighborhood ||
    location.locality ||
    location.subLocality ||
    ad.neighborhoodName ||
    null

  return {
    id: `${SOURCE}_${ad.id || ad.adId || Math.random()}`,
    title: ad.subject || ad.title || 'Propiedad en renta',
    price: price ? Number(String(price).replace(/[^0-9.]/g, '')) : null,
    neighborhood: neighborhood || null,
    size: ad.size || ad.area || ad.attributes?.surfaceTotalFormatted || null,
    bedrooms: ad.rooms || ad.bedrooms || ad.attributes?.rooms || null,
    image: ad.mainImage?.href || ad.imageUrl || ad.photos?.[0] || null,
    url: ad.url ? `${BASE_URL}${ad.url}` : ad.permalink || null,
    source: SOURCE,
  }
}

function parseJsonLdItem(item) {
  const address = item.address || {}
  const neighborhood =
    address.addressLocality ||
    address.neighborhood ||
    null

  return {
    id: `${SOURCE}_${item['@id'] || item.identifier || Math.random()}`,
    title: item.name || 'Propiedad en renta',
    price: item.offers?.price ? Number(String(item.offers.price).replace(/[^0-9.]/g, '')) : null,
    neighborhood: neighborhood || null,
    size: item.floorSize?.value || null,
    bedrooms: item.numberOfRooms || item.numberOfBedrooms || null,
    image: item.image?.[0] || item.image || null,
    url: item.url || null,
    source: SOURCE,
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
