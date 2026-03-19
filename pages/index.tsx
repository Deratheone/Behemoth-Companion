import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import ShinyText from '../components/ShinyText'
import Plasma from '../components/Plasma'
import InstallPWA from '../components/InstallPWA'
import AuthModal from '../components/AuthModal'
import UserBadge from '../components/UserBadge'
import ESP32ConnectionModal from '../components/ESP32ConnectionModal'
import { User, getUser, removeUser } from '../utils/auth'
import { useESP32Connection } from '../hooks/useESP32Connection'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showESP32Modal, setShowESP32Modal] = useState(false)
  const { isConnected } = useESP32Connection()

  // Load user from localStorage on mount
  useEffect(() => {
    setUser(getUser())
  }, [])

  // Handle successful authentication
  const handleAuthSuccess = (newUser: User) => {
    setUser(newUser)
    setShowAuthModal(false)
  }

  // Handle logout
  const handleLogout = () => {
    removeUser()
    setUser(null)
  }

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
        {/* PWA Install Button & Auth */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
          {user ? (
            <>
              {!isConnected && (
                <button
                  onClick={() => setShowESP32Modal(true)}
                  className="flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm text-white transition-colors hover:bg-cyan-500 shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Connect to Transplanter</span>
                  <span className="sm:hidden">Connect</span>
                </button>
              )}
              {isConnected && (
                <div className="flex items-center gap-2 rounded-xl bg-green-600/20 border border-green-500/30 px-3 py-2 text-sm text-green-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="hidden sm:inline">Connected</span>
                  <span className="sm:hidden">✓</span>
                </div>
              )}
              <UserBadge user={user} onLogout={handleLogout} />
            </>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-500 shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Login
            </button>
          )}
          <InstallPWA />
        </div>

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
          <div className="w-full">
            {/* Login prompt for guests */}
            {!user && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 text-center">
                <p className="text-gray-400 text-sm">
                  <span className="text-green-400 font-medium">Login</span> to unlock Health Bot, Field Map & GPS Tracker
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {/* Always visible */}
              <NavCard
                onClick={() => router.push('/chat')}
                icon="🤖"
                title="AI Chat"
                desc="Gemini-powered assistant"
                gradient="from-green-600/80 to-emerald-700/80"
                border="border-green-500/30 hover:border-green-400/60"
              />

              {/* Protected - only show when logged in */}
              {user && (
                <>
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
                </>
              )}

              {/* Always visible */}
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
        </div>

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />

        {/* ESP32 Connection Modal */}
        <ESP32ConnectionModal
          isOpen={showESP32Modal}
          onClose={() => setShowESP32Modal(false)}
          onConnected={() => setShowESP32Modal(false)}
        />
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
