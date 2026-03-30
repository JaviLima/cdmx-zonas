import { useEffect, useState } from 'react'
import Map from '../components/Map.jsx'

export default function MapView() {
  const [geojson, setGeojson] = useState(null)
  const [neighborhoodData, setNeighborhoodData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dataSource, setDataSource] = useState('live') // 'live' | 'mock'

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // Load GeoJSON
      let geo = null
      try {
        const geoRes = await fetch('/cdmx-neighborhoods.geojson')
        if (!geoRes.ok) throw new Error('GeoJSON not found')
        geo = await geoRes.json()
        setGeojson(geo)
      } catch (e) {
        setError('No se pudo cargar el mapa de colonias. Asegúrate de incluir cdmx-neighborhoods.geojson en /public.')
        setLoading(false)
        return
      }

      // Load neighborhood prices from API
      try {
        const apiRes = await fetch('/api/neighborhoods')
        if (apiRes.ok) {
          const data = await apiRes.json()
          setNeighborhoodData(data)
          setDataSource('live')
        } else {
          throw new Error('API unavailable')
        }
      } catch {
        // Fall back to mock data
        setNeighborhoodData(buildMockData(geo))
        setDataSource('mock')
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
        <div className="max-w-md text-center">
          <div className="w-12 h-12 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <Map geojson={geojson} neighborhoodData={neighborhoodData} />
      {dataSource === 'mock' && (
        <div className="absolute top-3 right-3 z-[1000] bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs text-amber-700">
          Usando datos de ejemplo. Despliega el Worker para datos reales.
        </div>
      )}
    </div>
  )
}

// Generate believable mock data from GeoJSON feature names
function buildMockData(geojson) {
  const mockPrices = {
    'Polanco': 28000,
    'Condesa': 22000,
    'Roma Norte': 20000,
    'Roma Sur': 18000,
    'Coyoacán': 16000,
    'Del Valle': 15000,
    'Narvarte Poniente': 14500,
    'Doctores': 10000,
    'Tepito': 8000,
    'Guerrero': 9000,
    'Santa Fe': 26000,
    'Lomas de Chapultepec': 35000,
    'Pedregal': 32000,
    'Xochimilco': 9500,
    'Iztapalapa': 7500,
    'Tlalpan': 12000,
    'Azcapotzalco': 10500,
    'Gustavo A. Madero': 9000,
    'Cuauhtémoc': 14000,
    'Benito Juárez': 17000,
  }

  const result = {}
  const allSources = ['inmuebles24', 'vivanuncios', 'lamudi']

  if (geojson?.features) {
    geojson.features.forEach((f) => {
      const name =
        f.properties?.NOMGEO ||
        f.properties?.nombre ||
        f.properties?.name ||
        f.properties?.COLONIA

      if (!name) return

      // Try exact match, then partial
      let price = mockPrices[name]
      if (!price) {
        const key = Object.keys(mockPrices).find((k) =>
          name.toLowerCase().includes(k.toLowerCase()) ||
          k.toLowerCase().includes(name.toLowerCase())
        )
        if (key) price = mockPrices[key]
      }
      if (!price) {
        // Random plausible price between 7k and 30k
        price = 7000 + Math.floor(Math.random() * 23000)
      }

      const count = Math.floor(Math.random() * 40) + 2
      const numSources = Math.floor(Math.random() * 3) + 1
      const sources = [...allSources].sort(() => 0.5 - Math.random()).slice(0, numSources)

      result[name] = { avgPrice: price, count, sources }
    })
  }

  return result
}
