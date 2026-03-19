import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import FloatingLines from '../components/FloatingLines'
import type { LoadStage } from '../components/SaplingDetector'
import SaplingDetector from '../components/SaplingDetector'
import { useAuthProtection } from '../hooks/useAuthProtection'
import { useESP32Connection } from '../hooks/useESP32Connection'

export default function Health() {
  const router = useRouter()
  const [loadStage, setLoadStage] = useState<LoadStage>('tf')
  const { isConnected } = useESP32Connection()

  // Protect route - redirect if not authenticated
  useAuthProtection()

  const isLoading = loadStage !== 'ready' && loadStage !== 'error'

  return (
    <>
      <Head>
        <title>Health Bot - Behemoth Companion</title>
        <meta name="description" content="AI-powered sapling detection using machine learning" />
      </Head>

      <main className="min-h-screen relative overflow-hidden bg-black">
        {/* Animated Background */}
        <div className="absolute inset-0 w-full h-full opacity-40">
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
              <h1 className="text-white font-bold text-lg">Health Bot</h1>
            </div>
            <div className="w-16" /> {/* Spacer for centering */}
          </div>

          {/* ESP Connection Status */}
          {!isConnected && (
            <div className="px-4 py-2 bg-yellow-900/20 border-l-2 border-yellow-600">
              <p className="text-xs text-yellow-300">⚠ ESP32 not connected — displaying mock data</p>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 flex items-center justify-center px-4 py-8 relative">
              <div className="relative w-full max-w-md mx-auto">
                <SaplingDetector onStageChange={setLoadStage} />
                {isLoading && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-2xl pointer-events-none">
                    <div className="text-center">
                      <p className="text-gray-300 text-sm mb-3">
                        {loadStage === 'tf' && 'Loading TensorFlow.js...'}
                        {loadStage === 'tm' && 'Loading ML libraries...'}
                        {loadStage === 'model' && 'Loading sapling model...'}
                      </p>
                      <div className="w-40 mx-auto bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: loadStage === 'tf' ? '15%' : loadStage === 'tm' ? '45%' : '75%' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>
      </main>
    </>
  )
}
