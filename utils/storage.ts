// User storage utilities for localStorage-based user management
// NOTE: This is a test implementation. Production apps should use a secure backend.

import { StoredUser, hashPassword, verifyPassword } from './auth'

const USERS_KEY = 'behemoth_users'

// Get all registered users

export function getAllUsers(): StoredUser[] {
  try {
    const stored = localStorage.getItem(USERS_KEY)
    if (!stored) return []
    return JSON.parse(stored) as StoredUser[]
  } catch (error) {
    console.error('Failed to get users from localStorage:', error)
    return []
  }
}

// Save all users to localStorage

function saveAllUsers(users: StoredUser[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
  } catch (error) {
    console.error('Failed to save users to localStorage:', error)
  }
}

// Register a new user

export function saveNewUser(email: string, password: string): void {
  const users = getAllUsers()
  const newUser: StoredUser = {
    email,
    passwordHash: hashPassword(password),
    createdAt: Date.now()
  }
  users.push(newUser)
  saveAllUsers(users)
}

// Find user by email

export function findUserByEmail(email: string): StoredUser | null {
  const users = getAllUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

// Verify login credentials

export function verifyCredentials(email: string, password: string): boolean {
  const user = findUserByEmail(email)
  if (!user) return false
  return verifyPassword(password, user.passwordHash)
}
