'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import { setLoadingCallbacks } from './authenticatedFetch'

interface ApiLoadingContextType {
  isLoading: boolean
  activeRequests: number
  startLoading: () => void
  stopLoading: () => void
}

const ApiLoadingContext = createContext<ApiLoadingContextType | undefined>(undefined)

export function ApiLoadingProvider({ children }: { children: ReactNode }) {
  const [activeRequests, setActiveRequests] = useState(0)

  const startLoading = useCallback(() => {
    setActiveRequests(prev => prev + 1)
  }, [])

  const stopLoading = useCallback(() => {
    setActiveRequests(prev => Math.max(0, prev - 1))
  }, [])

  // Register callbacks with authenticatedFetch
  useEffect(() => {
    setLoadingCallbacks(startLoading, stopLoading)
  }, [startLoading, stopLoading])

  const isLoading = activeRequests > 0

  return (
    <ApiLoadingContext.Provider value={{ isLoading, activeRequests, startLoading, stopLoading }}>
      {children}
    </ApiLoadingContext.Provider>
  )
}

export function useApiLoading() {
  const context = useContext(ApiLoadingContext)
  if (context === undefined) {
    throw new Error('useApiLoading must be used within ApiLoadingProvider')
  }
  return context
}
