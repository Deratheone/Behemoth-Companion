import Head from 'next/head'
import { useRouter } from 'next/router'
import FloatingLines from '../components/FloatingLines'
import FieldMapper from '../components/FieldMapper'
import { useAuthProtection } from '../hooks/useAuthProtection'
import { useESP32Connection } from '../hooks/useESP32Connection'

export default function FieldMap() {
  const router = useRouter()
  const { isConnected } = useESP32Connection()

  // Protect route - redirect if not authenticated
  useAuthProtection()

  return (
    <>
      <Head>
        <title>Field Map - Behemoth Companion</title>
        <meta name="description" content="ESP32-powered agricultural field mapping and crop monitoring system" />
      </Head>

      <main className="min-h-screen relative overflow-hidden bg-black">
        {/* Animated Background */}
        <div className="absolute inset-0 w-full h-full opacity-30">
          <FloatingLines />
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
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
              <h1 className="text-white font-bold text-lg">Field Map</h1>
            </div>
            <div className="w-16" />
          </div>

          {/* ESP Connection Status */}
          {!isConnected && (
            <div className="px-4 py-2 bg-yellow-900/20 border-l-2 border-yellow-600">
              <p className="text-xs text-yellow-300">⚠ ESP32 not connected — displaying mock data</p>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 px-2 pb-4">
            <FieldMapper />
          </div>
        </div>
      </main>
    </>
  )
}
