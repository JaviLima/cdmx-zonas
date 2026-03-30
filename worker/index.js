/**
 * CDMX Zonas — Cloudflare Worker
 *
 * Endpoints:
 *   GET /api/listings       → all scraped listings from KV
 *   GET /api/neighborhoods  → avg price per neighborhood from KV
 *   GET /api/status         → last scrape time + count
 *   POST /api/scrape        → manual trigger (immediate scrape)
 */

import { scrapeInmuebles24 } from './scrapers/inmuebles24.js'
import { scrapeVivanuncios } from './scrapers/vivanuncios.js'
import { scrapeLamudi } from './scrapers/lamudi.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Pages scraped per source in each run
const PAGES_CRON = 10   // Full run via cron (6h interval)
const PAGES_MANUAL = 5  // Manual /api/scrape trigger

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    switch (url.pathname) {
      case '/api/listings':
        return handleListings(env)
      case '/api/neighborhoods':
        return handleNeighborhoods(env)
      case '/api/status':
        return handleStatus(env)
      case '/api/scrape':
        if (request.method === 'POST') {
          // Run scrape inline (manual trigger)
          const result = await runScrape(env, PAGES_MANUAL)
          return jsonResponse(result)
        }
        return jsonResponse({ error: 'POST only' }, 405)
      default:
        return new Response('Not found', { status: 404, headers: CORS })
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScrape(env, PAGES_CRON))
  },
}

// ── Route handlers ─────────────────────────────────────────────────────────

async function handleListings(env) {
  try {
    const raw = await env.CDMX_KV.get('listings')
    return jsonResponse(raw ? JSON.parse(raw) : [])
  } catch (err) {
    console.error('[listings]', err)
    return jsonResponse([], 500)
  }
}

async function handleNeighborhoods(env) {
  try {
    const raw = await env.CDMX_KV.get('neighborhoods')
    return jsonResponse(raw ? JSON.parse(raw) : {})
  } catch (err) {
    console.error('[neighborhoods]', err)
    return jsonResponse({}, 500)
  }
}

async function handleStatus(env) {
  const [lastRun, listingsRaw] = await Promise.all([
    env.CDMX_KV.get('last_scrape'),
    env.CDMX_KV.get('listings'),
  ])
  let count = 0
  let bySource = {}
  try {
    const arr = listingsRaw ? JSON.parse(listingsRaw) : []
    count = arr.length
    for (const l of arr) {
      bySource[l.source] = (bySource[l.source] || 0) + 1
    }
  } catch {}
  return jsonResponse({ lastRun, listingCount: count, bySource })
}

// ── Core scrape pipeline ──────────────────────────────────────────────────

async function runScrape(env, maxPages = PAGES_CRON) {
  const startedAt = new Date().toISOString()
  console.log(`[scrape] start — ${maxPages} pages per source`)

  // Run all three scrapers concurrently (they each add delays internally)
  const results = await Promise.allSettled([
    scrapeInmuebles24(maxPages),
    scrapeVivanuncios(maxPages),
    scrapeLamudi(maxPages),
  ])

  const sourceNames = ['inmuebles24', 'vivanuncios', 'lamudi']
  let allListings = []
  const sourceCounts = {}

  results.forEach((r, i) => {
    const name = sourceNames[i]
    if (r.status === 'fulfilled') {
      const valid = r.value.filter(isValidListing)
      console.log(`[scrape] ${name}: ${valid.length} valid (of ${r.value.length} raw)`)
      sourceCounts[name] = valid.length
      allListings.push(...valid)
    } else {
      console.error(`[scrape] ${name} FAILED:`, r.reason?.message || r.reason)
      sourceCounts[name] = 0
    }
  })

  // Deduplicate by URL
  const seenUrls = new Set()
  allListings = allListings.filter((l) => {
    if (!l.url) return true
    if (seenUrls.has(l.url)) return false
    seenUrls.add(l.url)
    return true
  })

  // Ensure stable IDs
  allListings = allListings.map((l, i) => ({
    ...l,
    id: l.id || `listing_${i}_${Date.now()}`,
  }))

  // Compute neighborhood aggregates
  const neighborhoods = computeNeighborhoods(allListings)

  // Write to KV
  await Promise.all([
    env.CDMX_KV.put('listings', JSON.stringify(allListings)),
    env.CDMX_KV.put('neighborhoods', JSON.stringify(neighborhoods)),
    env.CDMX_KV.put('last_scrape', startedAt),
  ])

  const summary = {
    ok: true,
    startedAt,
    totalListings: allListings.length,
    totalNeighborhoods: Object.keys(neighborhoods).length,
    bySource: sourceCounts,
  }
  console.log('[scrape] done:', JSON.stringify(summary))
  return summary
}

// ── Data processing ───────────────────────────────────────────────────────

function computeNeighborhoods(listings) {
  const groups = {}
  for (const l of listings) {
    const name = normalizeNeighborhood(l.neighborhood)
    if (!name || !l.price || l.price < 1000 || l.price > 500000) continue
    if (!groups[name]) groups[name] = { prices: [], sources: new Set() }
    groups[name].prices.push(l.price)
    groups[name].sources.add(l.source)
  }
  const result = {}
  for (const [name, data] of Object.entries(groups)) {
    result[name] = {
      avgPrice: Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length),
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
    .replace(/\bcol\.\s*/i, '')
    .replace(/^colonia\s+/i, '')
    .replace(/\.$/, '')
}

function isValidListing(l) {
  if (!l || typeof l !== 'object') return false
  if (!l.source) return false
  if (!l.price || typeof l.price !== 'number') return false
  if (l.price < 1000 || l.price > 500000) return false
  if (!l.url || typeof l.url !== 'string') return false
  // Reject if URL is just the homepage (means we didn't get a real listing URL)
  if (/^https?:\/\/www\.(inmuebles24|vivanuncios|lamudi)\.[a-z.]+\/?$/.test(l.url)) return false
  return true
}

// ── Helpers ───────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
