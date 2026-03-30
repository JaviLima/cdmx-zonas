const SOURCES = [
  { id: 'inmuebles24', label: 'Inmuebles24' },
  { id: 'vivanuncios', label: 'Vivanuncios' },
  { id: 'lamudi', label: 'Lamudi' },
]

const BEDROOM_OPTIONS = [
  { value: '', label: 'Cualquiera' },
  { value: '1', label: '1 rec.' },
  { value: '2', label: '2 rec.' },
  { value: '3', label: '3 rec.' },
  { value: '4', label: '4+ rec.' },
]

function formatMXN(n) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

export default function FilterBar({ filters, onChange, neighborhoods, priceRange }) {
  const { neighborhood, minPrice, maxPrice, bedrooms, sources, onlyDeals } = filters

  function handleSourceToggle(sourceId) {
    const next = sources.includes(sourceId)
      ? sources.filter((s) => s !== sourceId)
      : [...sources, sourceId]
    onChange({ ...filters, sources: next })
  }

  return (
    <div className="bg-white border-b border-[#E5E7EB] px-4 py-3 flex flex-wrap gap-3 items-end">
      {/* Search / neighborhood */}
      <div className="flex flex-col gap-1 min-w-[150px]">
        <label className="text-[11px] text-[#6B7280] font-medium">Colonia</label>
        <div className="relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <select
            value={neighborhood}
            onChange={(e) => onChange({ ...filters, neighborhood: e.target.value })}
            className="text-sm pl-7 pr-2 py-1.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg text-[#111827] focus:outline-none focus:border-[#2563EB] w-full"
          >
            <option value="">Todas las colonias</option>
            {neighborhoods.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Price range */}
      <div className="flex flex-col gap-1 min-w-[180px]">
        <label className="text-[11px] text-[#6B7280] font-medium">
          Precio: {formatMXN(minPrice)} – {formatMXN(maxPrice)}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={priceRange.min}
            max={priceRange.max}
            step={500}
            value={minPrice}
            onChange={(e) =>
              onChange({ ...filters, minPrice: Math.min(Number(e.target.value), maxPrice - 500) })
            }
            className="flex-1 accent-[#2563EB]"
          />
          <input
            type="range"
            min={priceRange.min}
            max={priceRange.max}
            step={500}
            value={maxPrice}
            onChange={(e) =>
              onChange({ ...filters, maxPrice: Math.max(Number(e.target.value), minPrice + 500) })
            }
            className="flex-1 accent-[#2563EB]"
          />
        </div>
      </div>

      {/* Bedrooms */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-[#6B7280] font-medium">Recámaras</label>
        <select
          value={bedrooms}
          onChange={(e) => onChange({ ...filters, bedrooms: e.target.value })}
          className="text-sm border border-[#E5E7EB] rounded-lg px-2 py-1.5 bg-[#F8FAFC] text-[#111827] focus:outline-none focus:border-[#2563EB]"
        >
          {BEDROOM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Sources */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-[#6B7280] font-medium">Plataforma</label>
        <div className="flex gap-3">
          {SOURCES.map((src) => (
            <label key={src.id} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sources.includes(src.id)}
                onChange={() => handleSourceToggle(src.id)}
                className="accent-[#2563EB]"
              />
              <span className="text-xs text-[#6B7280]">{src.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Solo buenas ofertas toggle */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-[#6B7280] font-medium invisible">.</label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyDeals}
            onChange={(e) => onChange({ ...filters, onlyDeals: e.target.checked })}
            className="accent-[#2563EB]"
          />
          <span className="text-xs font-medium" style={{ color: '#065F46' }}>Solo buenas ofertas</span>
        </label>
      </div>
    </div>
  )
}
