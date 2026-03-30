import SourceBadge from './SourceBadge.jsx'

function formatPrice(price) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export default function ListingCard({ listing, selected, onToggleSelect }) {
  const { title, price, neighborhood, size, bedrooms, image, url, source, dealScore, dealLabel } = listing

  return (
    <div
      className={`flex items-stretch border rounded-lg overflow-hidden cursor-pointer transition-colors bg-white ${
        selected
          ? 'border-[#2563EB] ring-1 ring-[#2563EB]'
          : 'border-[#E5E7EB] hover:border-[#2563EB]'
      }`}
      onClick={onToggleSelect}
    >
      {/* Image — 90×90 fixed */}
      <div className="relative flex-shrink-0 w-[90px] h-[90px] bg-[#F8FAFC] overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            style={{ borderRadius: '0' }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#E5E7EB]">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd" />
            </svg>
          </div>
        )}
        {selected && (
          <div className="absolute top-1 left-1 w-4 h-4 bg-[#2563EB] rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-between relative">
        {/* Source badge — top right */}
        <div className="absolute top-2 right-2">
          <SourceBadge source={source} size="xs" />
        </div>

        <div className="pr-20">
          <p className="text-sm font-medium text-[#111827] leading-tight">
            {formatPrice(price)}
            <span className="text-[10px] font-normal text-[#6B7280]">/mes</span>
          </p>
          <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{title}</p>
          {neighborhood && (
            <p className="text-[10px] text-[#6B7280] truncate">{neighborhood}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {bedrooms != null && (
              <span className="text-[10px] text-[#6B7280]">{bedrooms} rec.</span>
            )}
            {size != null && (
              <span className="text-[10px] text-[#6B7280]">{size} m²</span>
            )}
          </div>
        </div>

        {/* Bottom row: deal badge + link */}
        <div className="flex items-center justify-between mt-1.5">
          {dealScore != null && dealScore > 0.10 && dealLabel ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: '#D1FAE5', color: '#065F46' }}>
              {dealLabel}
            </span>
          ) : (
            <span />
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] font-medium text-[#2563EB] hover:underline"
          >
            Ver anuncio →
          </a>
        </div>
      </div>
    </div>
  )
}
