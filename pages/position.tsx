import Head from 'next/head'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

const GPSTracker = dynamic(() => import('../components/GPSTracker'), { ssr: false })

export default function Position() {
  const router = useRouter()

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
            <img src="/logo.png" alt="Behemoth Companion" className="w-8 h-8 object-contain" />
            <h1 className="text-white font-bold text-lg">Position Data</h1>
          </div>
          <div className="w-16" />
        </div>

        {/* GPS Tracker */}
        <GPSTracker />
      </main>
    </>
  )
}
