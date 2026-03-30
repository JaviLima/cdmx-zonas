import { useEffect, useState, useMemo } from 'react'
import FilterBar from '../components/FilterBar.jsx'
import ListingCard from '../components/ListingCard.jsx'
import ComparePanel from '../components/ComparePanel.jsx'
import { MOCK_LISTINGS } from '../mockData.js'

const WORKER_URL = 'https://cdmx-zonas-worker.cdmx-zonas.workers.dev'

const DEFAULT_PRICE_RANGE = { min: 3000, max: 80000 }
const DEFAULT_FILTERS = {
  neighborhood: '',
  minPrice: 3000,
  maxPrice: 80000,
  bedrooms: '',
  sources: ['inmuebles24', 'vivanuncios', 'lamudi'],
  onlyDeals: true,
}

export default function SearchView() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [usingMock, setUsingMock] = useState(false)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selected, setSelected] = useState([])
  const [priceRange, setPriceRange] = useState(DEFAULT_PRICE_RANGE)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${WORKER_URL}/api/listings`)
        if (!res.ok) throw new Error('API not available')
        const data = await res.json()
        if (!Array.isArray(data) || data.length === 0) throw new Error('Empty')
        setListings(data)
        setUsingMock(false)
        const prices = data.map((l) => l.price).filter(Boolean)
        if (prices.length > 0) {
          const min = Math.floor(Math.min(...prices) / 500) * 500
          const max = Math.ceil(Math.max(...prices) / 500) * 500
          setPriceRange({ min, max })
          setFilters((f) => ({ ...f, minPrice: min, maxPrice: max }))
        }
      } catch {
        setListings(MOCK_LISTINGS)
        setUsingMock(true)
        const prices = MOCK_LISTINGS.map((l) => l.price)
        const min = Math.floor(Math.min(...prices) / 500) * 500
        const max = Math.ceil(Math.max(...prices) / 500) * 500
        setPriceRange({ min, max })
        setFilters((f) => ({ ...f, minPrice: min, maxPrice: max }))
      }
      setLoading(false)
    }
    load()
  }, [])

  const neighborhoods = useMemo(() => {
    const set = new Set(listings.map((l) => l.neighborhood).filter(Boolean))
    return [...set].sort()
  }, [listings])

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (filters.neighborhood && l.neighborhood !== filters.neighborhood) return false
      if (l.price < filters.minPrice || l.price > filters.maxPrice) return false
      if (filters.bedrooms) {
        const b = Number(filters.bedrooms)
        if (b >= 4) {
          if ((l.bedrooms ?? 0) < 4) return false
        } else {
          if (l.bedrooms !== b) return false
        }
      }
      if (!filters.sources.includes(l.source)) return false
      if (filters.onlyDeals && !(l.dealScore != null && l.dealScore > 0.10)) return false
      return true
    })
  }, [listings, filters])

  function toggleSelect(listing) {
    setSelected((prev) => {
      const idx = prev.findIndex((s) => s.id === listing.id)
      if (idx >= 0) return prev.filter((_, i) => i !== idx)
      if (prev.length >= 3) return prev
      return [...prev, listing]
    })
  }

  function removeFromCompare(idx) {
    setSelected((prev) => prev.filter((_, i) => i !== idx))
  }

  const compareBottomPadding = selected.length > 0 ? 'pb-52' : 'pb-4'

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F8FAFC]">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        neighborhoods={neighborhoods}
        priceRange={priceRange}
      />

      {/* Results area */}
      <div className={`flex-1 overflow-y-auto px-4 pt-3 ${compareBottomPadding}`}>
        {/* Status bar */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-[#6B7280]">
            {loading ? (
              'Cargando anuncios...'
            ) : (
              <>
                <span className="font-medium text-[#111827]">{filtered.length}</span> anuncios
                {filters.neighborhood && ` en ${filters.neighborhood}`}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <p className="text-xs text-[#2563EB] font-medium">
                {selected.length}/3 para comparar
              </p>
            )}
            {usingMock && !loading && (
              <span className="text-[10px] text-[#6B7280] bg-[#F8FAFC] border border-[#E5E7EB] px-2 py-0.5 rounded">
                Datos de ejemplo
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#6B7280] text-sm">No se encontraron anuncios con esos filtros.</p>
            <button
              onClick={() => setFilters({ ...DEFAULT_FILTERS, minPrice: priceRange.min, maxPrice: priceRange.max })}
              className="mt-3 text-sm text-[#2563EB] underline"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                selected={selected.some((s) => s.id === listing.id)}
                onToggleSelect={() => toggleSelect(listing)}
              />
            ))}
          </div>
        )}
      </div>

      <ComparePanel listings={selected} onRemove={removeFromCompare} />
    </div>
  )
}
