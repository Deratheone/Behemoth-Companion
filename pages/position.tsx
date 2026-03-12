import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, type ComponentType } from 'react'

export default function Position() {
  const router = useRouter()
  const [GPSTracker, setGPSTracker] = useState<ComponentType | null>(null)

  useEffect(() => {
    import('../components/GPSTracker').then((mod) => setGPSTracker(() => mod.default))
  }, [])

  return (
    <>
      <Head>
        <title>Position Data - Behemoth Companion</title>
        <meta name="description" content="ESP32 GPS live tracking and telemetry dashboard" />
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet" />
      </Head>

      <main className="min-h-screen relative overflow-hidden bg-[#060a10]">
        {/* Page header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#060a10] border-b border-[#1a2d4a] relative z-20">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Home</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white/10 overflow-hidden">
              <img src="/logo.png" alt="Behemoth Companion" className="h-full w-full scale-150 translate-y-0.5 object-cover" />
            </div>
            <h1 className="text-white font-bold text-lg">Position Data</h1>
          </div>
          <div className="w-16" />
        </div>

        {/* GPS Tracker */}
        {GPSTracker ? <GPSTracker /> : null}
      </main>
    </>
  )
}
