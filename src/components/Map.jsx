import { useEffect, useRef } from 'react'
import L from 'leaflet'

// Fix Leaflet default icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const PRICE_COLORS = {
  low: '#4ade80',
  mid: '#facc15',
  high: '#f87171',
  none: '#e5e7eb',
}

function getPriceTier(avgPrice, p33, p66) {
  if (!avgPrice) return 'none'
  if (avgPrice <= p33) return 'low'
  if (avgPrice <= p66) return 'mid'
  return 'high'
}

function computePercentiles(neighborhoodData) {
  const prices = Object.values(neighborhoodData)
    .map((d) => d.avgPrice)
    .filter(Boolean)
    .sort((a, b) => a - b)

  if (prices.length === 0) return { p33: 0, p66: 0 }

  const p33 = prices[Math.floor(prices.length * 0.33)]
  const p66 = prices[Math.floor(prices.length * 0.66)]
  return { p33, p66 }
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

const SOURCE_LABEL = {
  inmuebles24: 'Inmuebles24',
  vivanuncios: 'Vivanuncios',
  lamudi: 'Lamudi',
}

const SOURCE_BADGE_CLASS = {
  inmuebles24: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  vivanuncios: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  lamudi: 'bg-amber-50 text-amber-700 border border-amber-200',
}

function buildPopupHTML(name, data) {
  const price = data?.avgPrice
  const count = data?.count ?? 0
  const sources = data?.sources ?? []

  const sourceBadges = sources
    .map(
      (s) =>
        `<span style="display:inline-flex;align-items:center;font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid;" class="${SOURCE_BADGE_CLASS[s] || ''}">${SOURCE_LABEL[s] || s}</span>`
    )
    .join('')

  return `
    <div class="neighborhood-popup">
      <h3>${name}</h3>
      ${
        price
          ? `<p class="price">${formatPrice(price)}<span style="font-size:12px;font-weight:400;color:#9ca3af">/mes prom.</span></p>
             <p class="meta">${count} anuncio${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}</p>`
          : `<p class="meta" style="color:#9ca3af">Sin datos de renta</p>`
      }
      ${sources.length > 0 ? `<div class="sources">${sourceBadges}</div>` : ''}
    </div>
  `
}

export default function Map({ geojson, neighborhoodData }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const geoLayerRef = useRef(null)

  // Initialize map once
  useEffect(() => {
    if (mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: [19.43, -99.13],
      zoom: 11,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Re-render GeoJSON layer when data changes
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !geojson) return

    if (geoLayerRef.current) {
      geoLayerRef.current.remove()
    }

    const { p33, p66 } = computePercentiles(neighborhoodData)

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const name =
          feature.properties?.NOMGEO ||
          feature.properties?.nombre ||
          feature.properties?.name ||
          feature.properties?.COLONIA ||
          ''
        const data = neighborhoodData[name]
        const tier = getPriceTier(data?.avgPrice, p33, p66)
        return {
          fillColor: PRICE_COLORS[tier],
          fillOpacity: tier === 'none' ? 0.1 : 0.55,
          color: '#ffffff',
          weight: 0.8,
          opacity: 0.8,
        }
      },
      onEachFeature: (feature, featureLayer) => {
        const name =
          feature.properties?.NOMGEO ||
          feature.properties?.nombre ||
          feature.properties?.name ||
          feature.properties?.COLONIA ||
          'Colonia desconocida'
        const data = neighborhoodData[name]

        featureLayer.on({
          mouseover(e) {
            e.target.setStyle({ fillOpacity: 0.8, weight: 1.5, color: '#6366f1' })
          },
          mouseout(e) {
            layer.resetStyle(e.target)
          },
          click(e) {
            featureLayer
              .bindPopup(buildPopupHTML(name, data), {
                closeButton: true,
                autoPan: true,
              })
              .openPopup(e.latlng)
          },
        })
      },
    })

    layer.addTo(map)
    geoLayerRef.current = layer
  }, [geojson, neighborhoodData])

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-6 left-4 bg-white border border-gray-200 rounded-lg p-3 z-[1000] text-xs">
        <p className="font-semibold text-[#111827] mb-2">Precio promedio / mes</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: '#4ade80' }} />
            <span className="text-gray-600">Más económico (33%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: '#facc15' }} />
            <span className="text-gray-600">Precio medio (33%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: '#f87171' }} />
            <span className="text-gray-600">Más caro (33%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-sm flex-shrink-0 border border-gray-200" style={{ backgroundColor: '#e5e7eb' }} />
            <span className="text-gray-600">Sin datos</span>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-gray-400">Fuente: Inmuebles24, Vivanuncios, Lamudi</p>
      </div>
    </div>
  )
}
