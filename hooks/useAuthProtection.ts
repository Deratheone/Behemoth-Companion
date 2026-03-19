import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { isAuthenticated } from '../utils/auth'

export function useAuthProtection() {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/')
      return
    }
  }, [router])
}

