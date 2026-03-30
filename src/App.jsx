import { useState } from 'react'
import MapView from './pages/MapView.jsx'
import SearchView from './pages/SearchView.jsx'

const TABS = [
  { id: 'map', label: 'Mapa de rentas' },
  { id: 'search', label: 'Buscar y comparar' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('map')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Desktop header */}
      <header className="hidden md:flex flex-shrink-0 border-b border-[#E5E7EB] bg-white z-50">
        <div className="flex items-center justify-between px-4 h-14 w-full">
          <div className="flex items-center gap-2">
            <span className="text-base font-500 text-[#111827] tracking-tight">CDMX Zonas</span>
            <span className="text-xs text-[#6B7280]">Comparador de Rentas</span>
          </div>
          <nav className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-5 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#2563EB]'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563EB]" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile header — just logo */}
      <header className="md:hidden flex-shrink-0 border-b border-[#E5E7EB] bg-white z-50">
        <div className="flex items-center px-4 h-12">
          <span className="text-sm font-medium text-[#111827]">CDMX Zonas</span>
        </div>
      </header>

      {/* Content — leaves room for mobile tab bar */}
      <main className="flex-1 overflow-hidden md:mb-0 mb-12">
        <div className={`h-full tab-fade ${activeTab === 'map' ? 'block' : 'hidden'}`}>
          <MapView />
        </div>
        <div className={`h-full tab-fade ${activeTab === 'search' ? 'block' : 'hidden'}`}>
          <SearchView />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-50 flex">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'text-[#2563EB]' : 'text-[#6B7280]'
            }`}
          >
            {tab.id === 'map' ? (
              <svg className="w-5 h-5 mx-auto mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === tab.id ? 2 : 1.5}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6 3m0 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mx-auto mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === tab.id ? 2 : 1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
