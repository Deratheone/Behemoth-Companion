import { useState, useRef, useEffect } from 'react'
import StarBorder from './StarBorder'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface LocationData {
  latitude: number
  longitude: number
  timestamp: number
}

interface ChatWindowProps {
  shareLocation: boolean
  shareWeather: boolean
  location: LocationData | null
  weather: any
}

export default function ChatWindow({ shareLocation, shareWeather, location, weather }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hello! I\'m Behemoth Companion. How can I help you today?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages, loading])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Prepare context data
      const contextData: any = {
        message: text,
      }

      // Add location and time if enabled
      if (shareLocation && location) {
        contextData.location = {
          latitude: location.latitude,
          longitude: location.longitude,
        }
        contextData.currentTime = new Date().toISOString()
      }

      // Add weather if enabled
      if (shareWeather && weather) {
        contextData.weather = weather
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextData),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto touch-pan-y overscroll-contain bg-transparent"
      >
        <div className="mx-auto flex min-h-full min-w-0 max-w-4xl flex-col gap-4 sm:gap-6 px-3 sm:px-4 py-4 sm:py-6">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`group flex w-full items-start gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 overflow-hidden">
                  <img 
                    src="/logo.png" 
                    alt="Behemoth Companion" 
                    className="h-full w-full scale-150 translate-y-0.5 object-cover"
                  />
                </div>
              )}
              
              <div className={`flex min-w-0 max-w-[85%] sm:max-w-[80%] flex-col gap-2 ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}>
                <StarBorder
                  as="div"
                  className="w-full"
                  color={message.role === 'user' ? '#16a34a' : '#06b6d4'}
                  speed="4s"
                  thickness={2}
                >
                  <div className={`overflow-hidden rounded-2xl px-3 sm:px-4 py-2.5 text-sm ${
                    message.role === 'user'
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 backdrop-blur-md text-white border border-white/20'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </StarBorder>
              </div>

              {message.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white ring-1 ring-white/20">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex w-full items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="Behemoth Companion" 
                  className="h-full w-full scale-150 translate-y-0.5 object-cover"
                />
              </div>
              
              <div className="flex min-w-0 flex-col gap-2">
                <div className="overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-white/60"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-white/60" style={{animationDelay: '0.15s'}}></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-white/60" style={{animationDelay: '0.3s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Bar - always at bottom */}
      <div className="shrink-0 border-t border-white/10 bg-black/40 backdrop-blur-xl px-3 sm:px-4 py-3 sm:py-4 safe-area-inset-bottom">
        <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-4xl gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Send a message..."
              disabled={loading}
              rows={1}
              className="w-full resize-none rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-3 sm:px-4 py-3 pr-12 text-sm sm:text-base text-white placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                minHeight: '44px',
                maxHeight: '160px',
                fontSize: '16px',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white transition-colors hover:bg-green-500 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Send message"
          >
            {loading ? (
              <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
