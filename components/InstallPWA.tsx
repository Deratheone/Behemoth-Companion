import { useState, useEffect } from 'react'


interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPWA({ iconOnly = false }: { iconOnly?: boolean } = {}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setInstalled(true)
      }
      setDeferredPrompt(null)
    } else {
      setShowTip(true)
    }
  }

  if (installed) return null

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={iconOnly
          ? "flex items-center justify-center rounded-lg bg-green-600 w-12 h-12 text-white transition-colors hover:bg-green-500 shadow-lg p-0"
          : "flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-500 shadow-lg"
        }
        aria-label="Install Behemoth Companion"
      >
        <svg className={iconOnly ? "h-6 w-6" : "h-5 w-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {!iconOnly && <><span className="hidden sm:inline">Install App</span><span className="sm:hidden">Install</span></>}
      </button>

      {showTip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTip(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-gray-800">Install as App</h3>
              <button onClick={() => setShowTip(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <p><span className="font-semibold text-gray-700">Chrome / Edge:</span> Menu &rarr; &quot;Install app&quot;</p>
              <p><span className="font-semibold text-gray-700">Safari (iOS):</span> Share &rarr; &quot;Add to Home Screen&quot;</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
