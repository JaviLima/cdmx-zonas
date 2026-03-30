/**
 * CDMX Zonas — Cloudflare Worker
 *
 * Endpoints:
 *   GET /api/listings      → all scraped listings from KV
 *   GET /api/neighborhoods → avg price per neighborhood from KV
 *   POST /api/scrape       → manual trigger (dev only)
 *
 * Cron: scrape all three sources every 6 hours
 */

import { scrapeInmuebles24 } from './scrapers/inmuebles24.js'
import { scrapeVivanuncios } from './scrapers/vivanuncios.js'
import { scrapeLamudi } from './scrapers/lamudi.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  // ── HTTP handler ────────────────────────────────────────────────────────────
  async fetch(request, env) {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (url.pathname === '/api/listings') {
      return handleListings(env)
    }

    if (url.pathname === '/api/neighborhoods') {
      return handleNeighborhoods(env)
    }

    if (url.pathname === '/api/scrape' && request.method === 'POST') {
      // Allow manual trigger in dev/staging
      const result = await runScrape(env)
      return jsonResponse(result)
    }

    if (url.pathname === '/api/status') {
      return handleStatus(env)
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS })
  },

  // ── Scheduled cron handler (every 6 hours) ──────────────────────────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScrape(env))
  },
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleListings(env) {
  try {
    const raw = await env.CDMX_KV.get('listings')
    if (!raw) {
      return jsonResponse([])
    }
    return jsonResponse(JSON.parse(raw))
  } catch (err) {
    console.error('[listings] KV read error:', err)
    return jsonResponse([], 500)
  }
}

async function handleNeighborhoods(env) {
  try {
    const raw = await env.CDMX_KV.get('neighborhoods')
    if (!raw) {
      return jsonResponse({})
    }
    return jsonResponse(JSON.parse(raw))
  } catch (err) {
    console.error('[neighborhoods] KV read error:', err)
    return jsonResponse({}, 500)
  }
}

async function handleStatus(env) {
  const lastRun = await env.CDMX_KV.get('last_scrape')
  const listingsRaw = await env.CDMX_KV.get('listings')
  let count = 0
  try {
    count = listingsRaw ? JSON.parse(listingsRaw).length : 0
  } catch {}
  return jsonResponse({ lastRun, listingCount: count })
}

// ── Core scrape pipeline ──────────────────────────────────────────────────────

async function runScrape(env) {
  console.log('[scrape] starting...')
  const startedAt = new Date().toISOString()

  const results = await Promise.allSettled([
    scrapeInmuebles24(3),
    scrapeVivanuncios(3),
    scrapeLamudi(3),
  ])

  let allListings = []

  results.forEach((r, i) => {
    const sourceName = ['inmuebles24', 'vivanuncios', 'lamudi'][i]
    if (r.status === 'fulfilled') {
      const valid = r.value.filter(isValidListing)
      console.log(`[scrape] ${sourceName}: ${valid.length} valid listings`)
      allListings.push(...valid)
    } else {
      console.error(`[scrape] ${sourceName} failed:`, r.reason)
    }
  })

  // Deduplicate by URL
  const seen = new Set()
  allListings = allListings.filter((l) => {
    if (!l.url) return true
    if (seen.has(l.url)) return false
    seen.add(l.url)
    return true
  })

  // Assign stable IDs
  allListings = allListings.map((l, i) => ({
    ...l,
    id: l.id || `listing_${i}_${Date.now()}`,
  }))

  // Compute neighborhood aggregates
  const neighborhoodMap = computeNeighborhoods(allListings)

  // Store in KV
  await Promise.all([
    env.CDMX_KV.put('listings', JSON.stringify(allListings)),
    env.CDMX_KV.put('neighborhoods', JSON.stringify(neighborhoodMap)),
    env.CDMX_KV.put('last_scrape', startedAt),
  ])

  console.log(`[scrape] done. ${allListings.length} total listings, ${Object.keys(neighborhoodMap).length} neighborhoods`)

  return {
    ok: true,
    totalListings: allListings.length,
    neighborhoods: Object.keys(neighborhoodMap).length,
    startedAt,
  }
}

// ── Data processing ───────────────────────────────────────────────────────────

/**
 * Compute average price, listing count, and source set per neighborhood.
 * Returns: { [neighborhoodName]: { avgPrice, count, sources: string[] } }
 */
function computeNeighborhoods(listings) {
  const groups = {}

  for (const l of listings) {
    const name = normalizeNeighborhood(l.neighborhood)
    if (!name || !l.price || l.price < 1000 || l.price > 500000) continue

    if (!groups[name]) {
      groups[name] = { prices: [], sources: new Set() }
    }
    groups[name].prices.push(l.price)
    groups[name].sources.add(l.source)
  }

  const result = {}
  for (const [name, data] of Object.entries(groups)) {
    const avg = Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length)
    result[name] = {
      avgPrice: avg,
      count: data.prices.length,
      sources: [...data.sources],
    }
  }

  return result
}

function normalizeNeighborhood(name) {
  if (!name || typeof name !== 'string') return null
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/col\./i, 'Colonia')
    .replace(/^colonia\s+/i, '')
}

function isValidListing(l) {
  if (!l || typeof l !== 'object') return false
  if (!l.price || typeof l.price !== 'number') return false
  if (l.price < 1000 || l.price > 500000) return false
  if (!l.source) return false
  return true
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  })
}
