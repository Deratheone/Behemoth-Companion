import { useState, useMemo, useEffect } from 'react'
import { User, validateEmail, validatePassword, saveUser } from '../utils/auth'
import { findUserByEmail, saveNewUser, verifyCredentials } from '../utils/storage'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: User) => void
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Handle ESC key to close
  useEscapeKey(isOpen, onClose)

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (!isOpen) {
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setError('')
      setLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    setError('')
    setConfirmPassword('')
  }, [mode])

  // Validation
  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false
    if (!validateEmail(email)) return false
    if (!validatePassword(password)) return false
    if (mode === 'signup' && password !== confirmPassword) return false
    return true
  }, [email, password, confirmPassword, mode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || loading) return

    setLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        // Check if email already exists
        const existingUser = findUserByEmail(email)
        if (existingUser) {
          setError('An account with this email already exists')
          setLoading(false)
          return
        }

        // Create new user
        saveNewUser(email, password)

        // Log them in
        const newUser: User = {
          email,
          timestamp: Date.now()
        }
        saveUser(newUser)
        onSuccess(newUser)
      } else {
        // Login
        const isValid = verifyCredentials(email, password)
        if (!isValid) {
          setError('Invalid email or password')
          setLoading(false)
          return
        }

        // Log them in
        const user: User = {
          email,
          timestamp: Date.now()
        }
        saveUser(user)
        onSuccess(user)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              mode === 'login'
                ? 'bg-green-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              mode === 'signup'
                ? 'bg-green-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <label className="block">
            <span className="text-gray-400 text-xs uppercase tracking-wider">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              disabled={loading}
              autoComplete="email"
            />
          </label>

          {/* Password Input */}
          <label className="block">
            <span className="text-gray-400 text-xs uppercase tracking-wider">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'}
              className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              disabled={loading}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>

          {/* Confirm Password (Signup only) */}
          {mode === 'signup' && (
            <label className="block">
              <span className="text-gray-400 text-xs uppercase tracking-wider">Confirm Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                disabled={loading}
                autoComplete="new-password"
              />
            </label>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Validation Hints */}
          {mode === 'signup' && password && !validatePassword(password) && (
            <p className="text-amber-400 text-xs">Password must be at least 6 characters</p>
          )}
          {mode === 'signup' && confirmPassword && password !== confirmPassword && (
            <p className="text-amber-400 text-xs">Passwords do not match</p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
              canSubmit && !loading
                ? 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white shadow-xl hover:scale-[1.02]'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-4">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-green-400 hover:text-green-300 underline"
            disabled={loading}
          >
            {mode === 'login' ? 'Sign up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  )
}
