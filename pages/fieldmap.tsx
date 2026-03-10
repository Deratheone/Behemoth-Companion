import Head from 'next/head'
import { useRouter } from 'next/router'
import FloatingLines from '../components/FloatingLines'
import FieldMapper from '../components/FieldMapper'

export default function FieldMap() {
  const router = useRouter()

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
              <img src="/logo.png" alt="Behemoth Companion" className="w-8 h-8 object-contain" />
              <h1 className="text-white font-bold text-lg">Field Map</h1>
            </div>
            <div className="w-16" />
          </div>

          {/* Main Content */}
          <div className="flex-1 px-2 pb-4">
            <FieldMapper />
          </div>
        </div>
      </main>
    </>
  )
}
