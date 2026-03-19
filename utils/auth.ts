// Authentication utilities for localStorage-based auth
// NOTE: This is a test implementation only. Production apps should use
// secure backend authentication with bcrypt/Argon2 and proper session management.

export interface User {
  email: string
  timestamp: number
}

export interface StoredUser {
  email: string
  passwordHash: string
  createdAt: number
}

const CURRENT_USER_KEY = 'behemoth_current_user'

// Session Management

export function saveUser(user: User): void {
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
  } catch (error) {
    console.error('Failed to save user to localStorage:', error)
  }
}

export function getUser(): User | null {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY)
    if (!stored) return null
    return JSON.parse(stored) as User
  } catch (error) {
    console.error('Failed to get user from localStorage:', error)
    return null
  }
}

export function removeUser(): void {
  try {
    localStorage.removeItem(CURRENT_USER_KEY)
  } catch (error) {
    console.error('Failed to remove user from localStorage:', error)
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null
}

// Validation

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): boolean {
  return password.length >= 6
}

// Password Hashing
// WARNING: This is for testing only. Never use btoa for password hashing in production.
// Production: Use backend with bcrypt, Argon2, or similar secure hashing algorithms.

export function hashPassword(password: string): string {
  // Simple base64 encoding for test purposes only
  return btoa(password)
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}
