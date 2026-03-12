import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import ChatWindow from '../components/ChatWindow'
import FloatingLines from '../components/FloatingLines'
import InstallPWA from '../components/InstallPWA'

import type { LocationData } from '../components/ChatWindow'

export default function Chat() {
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)
  const [shareLocation, setShareLocation] = useState(true)
  const [shareWeather, setShareWeather] = useState(true)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [weather, setWeather] = useState<any>(null)

  useEffect(() => {
    if (shareLocation) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
            })
          },
          (error) => {
            console.error('Error getting location:', error)
            setShareLocation(false)
            alert('Unable to access location. Please enable location permissions.')
          }
        )
      } else {
        alert('Geolocation is not supported by your browser.')
        setShareLocation(false)
      }
    } else {
      setLocation(null)
      setWeather(null)
    }
  }, [shareLocation])

  useEffect(() => {
    if (shareWeather && location) {
      fetchWeather(location.latitude, location.longitude)
    } else {
      setWeather(null)
    }
  }, [shareWeather, location])

  const fetchWeather = async (latitude: number, longitude: number) => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=auto`
      )
      const data = await response.json()
      setWeather(data.current)
    } catch (error) {
      console.error('Error fetching weather:', error)
    }
  }

  return (
    <>
      <Head>
        <title>Chat - Behemoth Companion</title>
      </Head>

      <main className="h-dvh bg-black flex flex-col relative overflow-hidden">
        {/* FloatingLines Background */}
        <div className="fixed inset-0 z-0">
          <FloatingLines 
            enabledWaves={['top', 'middle', 'bottom']}
            lineCount={[4, 6, 8]}
            lineDistance={[10, 8, 6]}
            bendRadius={5.0}
            bendStrength={-0.5}
            interactive={true}
            parallax={true}
          />
        </div>

        {/* Header */}
        <header className="border-b border-white/10 bg-black/20 backdrop-blur-md text-white shadow-lg relative z-10">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1 sm:gap-2 text-white hover:text-green-100 transition-colors min-w-0"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium hidden xs:inline">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white/10 overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="Behemoth Companion"
                  className="h-full w-full scale-150 translate-y-0.5 object-cover" 
                />
              </div>
              <h1 className="text-lg sm:text-xl font-bold">Behemoth Companion</h1>
            </div>
            <div className="flex items-center gap-2">
              <InstallPWA />
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Settings"
              >
                <svg className="h-5 w-5 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-b border-white/10 bg-black/20 backdrop-blur-md px-3 sm:px-4 py-3 space-y-3 text-sm relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="shareLocation"
                  checked={shareLocation}
                  onChange={(e) => setShareLocation(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-green-500 focus:ring-2 focus:ring-white/30 focus:ring-offset-0"
                />
                <label htmlFor="shareLocation" className="cursor-pointer text-sm font-medium text-white">
                  Share location & time with AI
                </label>
              </div>
              {shareLocation && location && (
                <span className="flex items-center text-xs text-green-400">
                  <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Active
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="shareWeather"
                  checked={shareWeather}
                  onChange={(e) => setShareWeather(e.target.checked)}
                  disabled={!location}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-green-500 focus:ring-2 focus:ring-white/30 focus:ring-offset-0 disabled:opacity-50"
                />
                <label htmlFor="shareWeather" className={`cursor-pointer text-sm font-medium ${!location ? 'text-white/40' : 'text-white'}`}>
                  Share current weather with AI
                </label>
              </div>
              {shareWeather && weather && (
                <span className="flex items-center text-xs text-green-400">
                  <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                  </svg>
                  {weather.temperature_2m}°C
                </span>
              )}
            </div>

            {!location && (
              <p className="text-xs text-white/60 italic">
                Enable location sharing first to use weather data
              </p>
            )}
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          <ChatWindow 
            shareLocation={shareLocation}
            shareWeather={shareWeather}
            location={location}
            weather={weather}
          />
        </div>
      </main>
    </>
  )
}
