const SOURCE_CONFIG = {
  inmuebles24: {
    label: 'Inmuebles24',
    style: 'background:#EBF4FF;color:#1a6bb5;border:1px solid #bfdbfe',
  },
  vivanuncios: {
    label: 'Vivanuncios',
    style: 'background:#E8F5E9;color:#2e7d32;border:1px solid #a5d6a7',
  },
  lamudi: {
    label: 'Lamudi',
    style: 'background:#FFF8E1;color:#b45309;border:1px solid #fde68a',
  },
}

export default function SourceBadge({ source, size = 'sm' }) {
  const config = SOURCE_CONFIG[source]
  if (!config) return null

  const sizeClass = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center font-medium rounded ${sizeClass}`}
      style={{ ...parseStyle(config.style) }}
    >
      {config.label}
    </span>
  )
}

function parseStyle(styleStr) {
  const obj = {}
  for (const part of styleStr.split(';')) {
    const [k, v] = part.split(':').map((s) => s.trim())
    if (k && v) {
      const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      obj[camel] = v
    }
  }
  return obj
}

export { SOURCE_CONFIG }
