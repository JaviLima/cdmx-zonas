import SourceBadge from './SourceBadge.jsx'

function formatPrice(price) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

function Row({ label, values }) {
  return (
    <tr className="border-t border-[#E5E7EB]">
      <td className="py-2.5 pr-4 text-[11px] text-[#6B7280] font-medium whitespace-nowrap w-24">{label}</td>
      {values.map((val, i) => (
        <td key={i} className="py-2.5 px-3 text-sm text-[#111827] text-center">
          {val ?? <span className="text-[#E5E7EB]">—</span>}
        </td>
      ))}
    </tr>
  )
}

export default function ComparePanel({ listings, onRemove }) {
  if (listings.length === 0) return null

  const pad = 3 - listings.length
  const cols = [...listings, ...Array(pad).fill(null)]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-50 md:bottom-0 bottom-12">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#111827]">
            Comparando {listings.length} {listings.length === 1 ? 'propiedad' : 'propiedades'}
            <span className="text-[#6B7280] font-normal"> (máx. 3)</span>
          </h3>
          <button
            onClick={() => listings.forEach((_, i) => onRemove(i))}
            className="text-xs text-[#6B7280] hover:text-[#111827]"
          >
            Limpiar todo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <td className="w-24" />
                {cols.map((listing, i) =>
                  listing ? (
                    <th key={i} className="px-3 pb-2 text-center">
                      <div className="relative">
                        <button
                          onClick={() => onRemove(i)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-[#F8FAFC] border border-[#E5E7EB] hover:bg-[#E5E7EB] rounded-full text-[#6B7280] flex items-center justify-center text-[10px] leading-none"
                        >
                          ×
                        </button>
                        <SourceBadge source={listing.source} size="xs" />
                        <p className="text-[11px] text-[#6B7280] mt-1 truncate max-w-[120px] mx-auto">
                          {listing.neighborhood}
                        </p>
                      </div>
                    </th>
                  ) : (
                    <th key={i} className="px-3 pb-2 text-center">
                      <div className="border border-dashed border-[#E5E7EB] rounded h-10 flex items-center justify-center">
                        <span className="text-[11px] text-[#E5E7EB]">Vacío</span>
                      </div>
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              <Row
                label="Precio"
                values={cols.map((l) => l && <span className="font-medium text-[#2563EB]">{formatPrice(l.price)}</span>)}
              />
              <Row label="Recámaras" values={cols.map((l) => l?.bedrooms != null ? `${l.bedrooms} rec.` : null)} />
              <Row label="Tamaño" values={cols.map((l) => l?.size != null ? `${l.size} m²` : null)} />
              <Row label="Colonia" values={cols.map((l) => l?.neighborhood)} />
              <Row
                label="Ver"
                values={cols.map((l) =>
                  l ? (
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2563EB] text-xs underline"
                    >
                      Abrir
                    </a>
                  ) : null
                )}
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
