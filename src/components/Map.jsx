import { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const PRICE_COLORS = { low: '#4ade80', mid: '#facc15', high: '#f87171', none: '#e5e7eb' }

function computePercentiles(neighborhoodData) {
  const prices = Object.values(neighborhoodData).map((d) => d.avgPrice).filter(Boolean).sort((a, b) => a - b)
  if (!prices.length) return { p33: 0, p66: 0 }
  return { p33: prices[Math.floor(prices.length * 0.33)], p66: prices[Math.floor(prices.length * 0.66)] }
}

function getPriceTier(avgPrice, p33, p66) {
  if (!avgPrice) return 'none'
  if (avgPrice <= p33) return 'low'
  if (avgPrice <= p66) return 'mid'
  return 'high'
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)
}

const SOURCE_LABELS = { inmuebles24: 'Inmuebles24', vivanuncios: 'Vivanuncios', lamudi: 'Lamudi' }
const SOURCE_COLORS = {
  inmuebles24: 'background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe',
  vivanuncios: 'background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0',
  lamudi: 'background:#fffbeb;color:#92400e;border:1px solid #fde68a',
}

function buildPopupHTML(name, alcaldia, data) {
  const price = data?.avgPrice
  const count = data?.count ?? 0
  const sources = data?.sources ?? []
  const badges = sources.map((s) =>
    `<span style="display:inline-flex;align-items:center;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:500;${SOURCE_COLORS[s] || ''}">${SOURCE_LABELS[s] || s}</span>`
  ).join('')
  return `<div class="neighborhood-popup">
    <h3>${name}</h3>
    ${alcaldia ? `<p style="font-size:11px;color:#9ca3af;margin:0 0 8px 0">${alcaldia}</p>` : ''}
    ${price
      ? `<p class="price">${formatPrice(price)}<span style="font-size:12px;font-weight:400;color:#9ca3af">/mes prom.</span></p>
         <p class="meta">${count} anuncio${count !== 1 ? 's' : ''}</p>`
      : `<p class="meta" style="color:#9ca3af">Sin datos de renta</p>`}
    ${sources.length > 0 ? `<div class="sources">${badges}</div>` : ''}
  </div>`
}

export default function Map({ geojson, neighborhoodData }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const geoLayerRef = useRef(null)
  const [selectedAlcaldia, setSelectedAlcaldia] = useState(null)

  // Extract sorted alcaldías from GeoJSON features
  const alcaldias = useMemo(() => {
    if (!geojson?.features) return []
    const set = new Set(geojson.features.map((f) => f.properties?.ALCALDIA).filter(Boolean))
    return [...set].sort()
  }, [geojson])

  // Aggregate avg price per alcaldía for showing in the filter bar
  const alcaldiaAvg = useMemo(() => {
    if (!geojson?.features) return {}
    const groups = {}
    for (const f of geojson.features) {
      const alc = f.properties?.ALCALDIA
      const nom = f.properties?.NOMGEO
      if (!alc || !nom) continue
      const d = neighborhoodData[nom]
      if (!d?.avgPrice) continue
      if (!groups[alc]) groups[alc] = []
      groups[alc].push(d.avgPrice)
    }
    const result = {}
    for (const [alc, prices] of Object.entries(groups)) {
      result[alc] = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    }
    return result
  }, [geojson, neighborhoodData])

  // Init map once
  useEffect(() => {
    if (mapInstanceRef.current) return
    const map = L.map(mapRef.current, { center: [19.41, -99.17], zoom: 11, zoomControl: true })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)
    mapInstanceRef.current = map
    return () => { map.remove(); mapInstanceRef.current = null }
  }, [])

  // Redraw GeoJSON layer when data or alcaldía selection changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !geojson) return
    if (geoLayerRef.current) geoLayerRef.current.remove()

    const { p33, p66 } = computePercentiles(neighborhoodData)

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const name = feature.properties?.NOMGEO || ''
        const alc = feature.properties?.ALCALDIA || ''
        const data = neighborhoodData[name]
        const tier = getPriceTier(data?.avgPrice, p33, p66)
        const active = !selectedAlcaldia || alc === selectedAlcaldia
        return {
          fillColor: active ? PRICE_COLORS[tier] : '#f3f4f6',
          fillOpacity: active ? (tier === 'none' ? 0.15 : 0.60) : 0.08,
          color: active ? '#fff' : '#e5e7eb',
          weight: active ? 1.2 : 0.5,
          opacity: active ? 1 : 0.4,
        }
      },
      onEachFeature: (feature, fl) => {
        const name = feature.properties?.NOMGEO || 'Colonia'
        const alc = feature.properties?.ALCALDIA || ''
        const data = neighborhoodData[name]

        fl.on({
          mouseover(e) {
            const active = !selectedAlcaldia || alc === selectedAlcaldia
            if (active) e.target.setStyle({ fillOpacity: 0.85, weight: 2, color: '#6366f1' })
          },
          mouseout(e) { layer.resetStyle(e.target) },
          click(e) {
            fl.bindPopup(buildPopupHTML(name, alc, data), { closeButton: true, autoPan: true })
              .openPopup(e.latlng)
          },
        })
      },
    })

    layer.addTo(map)
    geoLayerRef.current = layer

    // Fit map bounds to selected alcaldía
    if (selectedAlcaldia) {
      const matching = geojson.features.filter((f) => f.properties?.ALCALDIA === selectedAlcaldia)
      if (matching.length) {
        try {
          const bounds = L.geoJSON({ type: 'FeatureCollection', features: matching }).getBounds()
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
        } catch {}
      }
    } else {
      map.setView([19.41, -99.17], 11)
    }
  }, [geojson, neighborhoodData, selectedAlcaldia])

  return (
    <div className="flex flex-col h-full">
      {/* Alcaldía filter bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 overflow-x-auto bg-white border-b border-gray-100"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <button
          onClick={() => setSelectedAlcaldia(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            !selectedAlcaldia
              ? 'bg-[#6366f1] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todas
        </button>
        {alcaldias.map((alc) => (
          <button
            key={alc}
            onClick={() => setSelectedAlcaldia(selectedAlcaldia === alc ? null : alc)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedAlcaldia === alc
                ? 'bg-[#6366f1] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {alc}
            {alcaldiaAvg[alc] && (
              <span className={`text-[10px] ${selectedAlcaldia === alc ? 'opacity-80' : 'text-gray-400'}`}>
                {formatPrice(alcaldiaAvg[alc])}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Map area */}
      <div className="relative flex-1">
        <div ref={mapRef} className="w-full h-full" />

        {/* Legend */}
        <div className="absolute bottom-5 left-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5 z-[1000] text-xs shadow-sm">
          <p className="font-semibold text-[#111827] mb-1.5 text-[11px]">Precio prom. / mes</p>
          {[
            { color: '#4ade80', label: 'Más económico' },
            { color: '#facc15', label: 'Precio medio' },
            { color: '#f87171', label: 'Más caro' },
            { color: '#e5e7eb', label: 'Sin datos', border: true },
          ].map(({ color, label, border }) => (
            <div key={label} className="flex items-center gap-1.5 mb-1">
              <span
                className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: color, border: border ? '1px solid #d1d5db' : 'none' }}
              />
              <span className="text-gray-500 text-[11px]">{label}</span>
            </div>
          ))}
          <p className="mt-1.5 text-[10px] text-gray-300">Inmuebles24 · Vivanuncios · Lamudi</p>
        </div>

        {/* Selected alcaldía badge */}
        {selectedAlcaldia && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white border border-[#6366f1] rounded-full px-3 py-1 shadow-sm">
            <span className="text-xs font-medium text-[#6366f1]">{selectedAlcaldia}</span>
            <button
              onClick={() => setSelectedAlcaldia(null)}
              className="text-[#6366f1] hover:text-indigo-800 text-sm leading-none"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
