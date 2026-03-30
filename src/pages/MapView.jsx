import { useEffect, useState } from 'react'
import Map from '../components/Map.jsx'

export default function MapView() {
  const [geojson, setGeojson] = useState(null)
  const [neighborhoodData, setNeighborhoodData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [usingMock, setUsingMock] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // Load GeoJSON
      let geo = null
      try {
        const res = await fetch('/cdmx-neighborhoods.geojson')
        if (!res.ok) throw new Error('GeoJSON not found')
        geo = await res.json()
        setGeojson(geo)
      } catch {
        setError('No se pudo cargar el archivo cdmx-neighborhoods.geojson desde /public.')
        setLoading(false)
        return
      }

      // Try live Worker API first
      try {
        const apiRes = await fetch('/api/neighborhoods')
        if (!apiRes.ok) throw new Error('API unavailable')
        const data = await apiRes.json()
        // Check if we actually got neighborhood data (non-empty object)
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          setNeighborhoodData(data)
          setUsingMock(false)
        } else {
          throw new Error('Empty response')
        }
      } catch {
        // Fall back to mock data generated from GeoJSON feature names
        setNeighborhoodData(buildMockData(geo))
        setUsingMock(true)
      }

      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <p className="text-sm text-gray-500 text-center max-w-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      <Map geojson={geojson} neighborhoodData={neighborhoodData} />
      {usingMock && (
        <div className="absolute top-12 right-3 z-[1000] bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs text-amber-700 pointer-events-none">
          Datos de ejemplo — despliega el Worker para datos reales
        </div>
      )}
    </div>
  )
}

// Build mock neighborhood data from GeoJSON feature names
function buildMockData(geojson) {
  const KNOWN_PRICES = {
    'Lomas de Chapultepec': 52000, 'Santa Fe': 42000, 'Santa Fe Norte': 38000,
    'Polanco': 36000, 'Interlomas': 32000, 'Lomas de Bezares': 30000,
    'San Ángel': 29000, 'Hipódromo Condesa': 25000, 'Condesa': 24000,
    'Anzures': 22000, 'Roma Norte': 20000, 'Roma Sur': 19000,
    'Escandón': 18000, 'Del Valle': 17000, 'Del Valle Norte': 16500,
    'Narvarte Poniente': 15500, 'Benito Juárez': 15000, 'Churubusco': 14500,
    'Tlatelolco': 14000, 'Centro Histórico': 13500, 'Obrera': 12000,
    'Doctores': 11500, 'Portales Norte': 13000, 'Mixcoac': 15000,
    'Álvaro Obregón': 13000, 'San Ángel Inn': 26000, 'Pedregal': 24000,
    'Pedregal de San Ángel': 22000, 'Pedregal de San Francisco': 15000,
    'Coyoacán': 22000, 'Villa Coyoacán': 20000, 'Villa Quietud': 13000,
    'Iztacalco': 10000, 'Iztacalco Norte': 9500, 'Agrícola Oriental': 9000,
    'Santa Anita': 8500, 'Jardín Balbuena': 10500, 'Aeropuerto': 9000,
    'Pensador Mexicano': 8500, 'Iztapalapa': 8000, 'Iztapalapa Sur': 7500,
    'Iztapalapa Centro': 7800, 'Santa Cruz Meyehualco': 7500, 'Los Reyes': 7000,
    'San Miguel Teotongo': 6800, 'Tláhuac': 8000, 'Xochimilco': 9500,
    'San Gregorio Atlapulco': 8500, 'Tlalpan': 12000,
    'Cuajimalpa': 16000, 'Azcapotzalco': 11000, 'San Álvaro': 10500,
    'Industrial Vallejo': 10000, 'San Pedro Xalpa': 9500,
    'Guerrero': 9000, 'Tepito': 8000, 'Peralvillo': 9500, 'Popotla': 11000,
    'San Cosme': 12000, 'Vallejo': 10000, 'La Raza': 10500, 'Lindavista': 14000,
    'La Villa': 11000, 'San Juan de Aragón': 10000, 'Aragón': 9500,
    'La Villa Norte': 10500, 'Martín Carrera': 9000, 'Zacatenco': 9000,
    'Milpa Alta': 7000, 'San Lorenzo Tlacoyucan': 6500,
  }

  const ALL_SOURCES = ['inmuebles24', 'vivanuncios', 'lamudi']
  const result = {}

  if (geojson?.features) {
    geojson.features.forEach((f) => {
      const name = f.properties?.NOMGEO
      if (!name) return
      let price = KNOWN_PRICES[name]
      if (!price) price = 7000 + Math.floor(Math.random() * 20000)
      const count = Math.floor(Math.random() * 45) + 3
      const numSrc = Math.floor(Math.random() * 3) + 1
      const sources = [...ALL_SOURCES].sort(() => 0.5 - Math.random()).slice(0, numSrc)
      result[name] = { avgPrice: price, count, sources }
    })
  }

  return result
}
