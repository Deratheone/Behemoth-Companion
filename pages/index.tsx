import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import ShinyText from '../components/ShinyText'
import Plasma from '../components/Plasma'
import InstallPWA from '../components/InstallPWA'

export default function Home() {
  const router = useRouter()
  const [showPWAInfo, setShowPWAInfo] = useState(false)

  return (
    <>
      <Head>
        <title>Behemoth Companion</title>
        <meta name="description" content="AI chat, sapling health detection, field mapping, and GPS tracking — all in one companion app." />
      </Head>

      <main className="min-h-screen relative overflow-hidden bg-black">
        {/* Plasma Background */}
        <div className="absolute inset-0 w-full h-full">
          <Plasma
            color="#10b981"
            speed={0.4}
            direction="forward"
            scale={1.1}
            opacity={1.0}
            mouseInteractive={true}
          />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 min-h-screen flex flex-col">
        {/* PWA Install & Info Button */}
        <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
          <InstallPWA />
          <button
            onClick={() => setShowPWAInfo(!showPWAInfo)}
            className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-green-600 hover:bg-gray-50 transition-all"
            aria-label="PWA Installation Info"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* PWA Info Modal */}
        {showPWAInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowPWAInfo(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-800">📲 Install as App</h3>
                <button onClick={() => setShowPWAInfo(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-sm text-gray-600 space-y-3">
                <div>
                  <p className="font-semibold text-gray-700">Android Chrome:</p>
                  <p className="ml-2">Menu (⋮) → &quot;Add to Home screen&quot;</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-700">iOS Safari:</p>
                  <p className="ml-2">Share → &quot;Add to Home Screen&quot;</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
          {/* Hero */}
          <div className="text-center mb-6 sm:mb-8">
            <img 
              src="/logo.png" 
              alt="Behemoth Companion" 
              className="w-24 h-24 sm:w-32 sm:h-32 mx-auto object-contain mb-3"
            />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-1 tracking-tight">
              <ShinyText
                text="BEHEMOTH COMPANION"
                speed={2}
                delay={0}
                color="#d1d5db"
                shineColor="#ffffff"
                spread={120}
                direction="left"
                yoyo={false}
                pauseOnHover={false}
              />
            </h1>
            <p className="text-sm sm:text-base text-white/60 font-light">
              Your all-in-one agricultural assistant
            </p>
          </div>

          {/* Navigation Grid */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 w-full">
            <NavCard
              onClick={() => router.push('/chat')}
              icon="🤖"
              title="AI Chat"
              desc="Gemini-powered assistant"
              gradient="from-green-600/80 to-emerald-700/80"
              border="border-green-500/30 hover:border-green-400/60"
            />
            <NavCard
              onClick={() => router.push('/health')}
              icon="🌱"
              title="Health Bot"
              desc="ML sapling detection"
              gradient="from-cyan-600/80 to-teal-700/80"
              border="border-cyan-500/30 hover:border-cyan-400/60"
            />
            <NavCard
              onClick={() => router.push('/fieldmap')}
              icon="🗺️"
              title="Field Map"
              desc="ESP32 crop grid"
              gradient="from-lime-600/80 to-green-700/80"
              border="border-lime-500/30 hover:border-lime-400/60"
            />
            <NavCard
              onClick={() => router.push('/position')}
              icon="📍"
              title="Position"
              desc="Live GPS tracker"
              gradient="from-sky-600/80 to-blue-700/80"
              border="border-sky-500/30 hover:border-sky-400/60"
            />
            <NavCard
              onClick={() => router.push('/hire')}
              icon="🚜"
              title="Hire"
              desc="Rent transplanter"
              gradient="from-amber-500/80 to-orange-600/80"
              border="border-amber-500/30 hover:border-amber-400/60"
            />
          </div>
        </div>
        </div>
      </main>
    </>
  )
}

function NavCard({ onClick, icon, title, desc, gradient, border }: {
  onClick: () => void; icon: string; title: string; desc: string; gradient: string; border: string
}) {
  return (
    <button
      onClick={onClick}
      className={`group text-left p-4 sm:p-5 bg-gradient-to-br ${gradient} rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.03] border ${border} w-[calc(50%-6px)] sm:w-[calc(33.333%-11px)]`}
    >
      <div className="text-2xl sm:text-3xl mb-2">{icon}</div>
      <h3 className="font-bold text-white text-sm sm:text-base">{title}</h3>
      <p className="text-white/60 text-xs sm:text-sm mt-0.5">{desc}</p>
    </button>
  )
}
