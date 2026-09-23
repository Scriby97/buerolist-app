'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { User as SupabaseUser, AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { authenticatedFetch } from '@/lib/api/authenticatedFetch'
import { checkBackendHealth } from '@/lib/api/healthCheck'
import { buildApiUrl, getApiBaseUrlOrNull } from '@/lib/api/url'
import { getMyOrganizations } from '@/lib/api/organizations'
import type { User, Organization, OrganizationMembership, OrganizationRole } from '@/lib/types/user'

interface AuthContextType {
  supabaseUser: SupabaseUser | null
  userProfile: User | null
  loading: boolean
  backendLoading: boolean
  backendRetryCount: number
  // Globale Rolle "administrator" - ausschliesslich für Entwickler-Accounts,
  // die organisationsübergreifend auf alle Daten zugreifen können. Es gibt
  // keine separate "super_admin"-Stufe (mehr).
  isAdmin: boolean
  userRole: string | null
  organizationId: string | null
  organization: Organization | null
  organizationMemberships: OrganizationMembership[]
  organizationRole: OrganizationRole | null
  hasOrganization: boolean
  canManageOrganization: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, metadata?: { firstName?: string, lastName?: string, role?: string }) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  refreshUserRole: () => Promise<void>
  refreshOrganizations: () => Promise<OrganizationMembership[]>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [backendLoading, setBackendLoading] = useState(false)
  const [backendRetryCount, setBackendRetryCount] = useState(0)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [organizationMemberships, setOrganizationMemberships] = useState<OrganizationMembership[]>([])

  // Stable supabase client – created once per mount
  const supabase = useMemo(() => createClient(), [])

  // Track number of active fetchUserRole calls
  const fetchingCountRef = useRef(0)
  // Flag to avoid processing onAuthStateChange events before initAuth completes
  const initAuthCompletedRef = useRef(false)
  // Ref to always hold the latest supabaseUser without being a useEffect dependency
  const supabaseUserRef = useRef(supabaseUser)

  // Keep ref in sync with latest supabaseUser value - in an effect (not
  // during render) since mutating a ref during render is a React anti-pattern
  // the compiler flags (react-hooks/refs).
  useEffect(() => {
    supabaseUserRef.current = supabaseUser
  }, [supabaseUser])

  // Compute derived values
  const isAdmin = userRole === 'administrator'
  const organizationId = organizationMemberships[0]?.organizationId ?? null
  const organization = organizationMemberships[0]?.organization ?? null
  const organizationRole = organizationMemberships[0]?.role ?? null
  const hasOrganization = organizationMemberships.length > 0
  // Owner has all rights an org-admin has (role hierarchy owner > admin > employee)
  const canManageOrganization = isAdmin || organizationRole === 'admin' || organizationRole === 'owner'
  const isResetPasswordRoute = pathname?.startsWith('/reset-password') ?? false

  // Function to fetch the organizations the current user is a member of
  const fetchOrganizationMemberships = useCallback(async () => {
    try {
      const memberships = await getMyOrganizations()
      setOrganizationMemberships(memberships)
      return memberships
    } catch (error) {
      console.error('Fehler beim Abrufen der Organisationen:', error)
      setOrganizationMemberships([])
      return []
    }
  }, [])

  // Function to fetch user profile from backend
  const fetchUserRole = useCallback(async () => {
    // Increment counter
    fetchingCountRef.current++

    // Deduplicate concurrent calls
    if (fetchingCountRef.current > 1) {
      fetchingCountRef.current--
      return null
    }

    setBackendRetryCount(0)
    setBackendLoading(true)

    try {
      const apiBaseUrl = getApiBaseUrlOrNull()
      if (!apiBaseUrl) {
        console.warn('NEXT_PUBLIC_API_URL nicht konfiguriert')
        fetchingCountRef.current--
        if (fetchingCountRef.current === 0) setBackendLoading(false)
        return null
      }

      // First, check if backend is available using lightweight health check
      const healthResult = await checkBackendHealth({
        retries: 8,
        retryDelay: 2000,
        useExponentialBackoff: true,
        onRetry: (attempt: number) => {
          setBackendRetryCount(attempt)
        }
      })

      if (!healthResult.available) {
        fetchingCountRef.current--
        if (fetchingCountRef.current === 0) {
          setBackendLoading(false)
          setBackendRetryCount(0)
        }
        return null
      }

      // Backend is available, now fetch actual user data
      const response = await authenticatedFetch(buildApiUrl('/auth/me'), {
        retries: 2,
        retryDelay: 1000,
        skipLoadingIndicator: true,
      })

      if (!response.ok) {
        console.error('Fehler beim Abrufen des Benutzerprofils:', response.status)
        fetchingCountRef.current--
        if (fetchingCountRef.current === 0) {
          setBackendLoading(false)
          setBackendRetryCount(0)
        }
        return null
      }

      const profile: User = await response.json()
      setUserProfile(profile)
      await fetchOrganizationMemberships()

      fetchingCountRef.current--
      if (fetchingCountRef.current === 0) {
        setBackendLoading(false)
        setBackendRetryCount(0)
      }

      return profile.role
    } catch (error) {
      console.error('Fehler beim Abrufen des Benutzerprofils:', error)
      fetchingCountRef.current--
      if (fetchingCountRef.current === 0) {
        setBackendLoading(false)
        setBackendRetryCount(0)
      }
      return null
    }
  }, [fetchOrganizationMemberships])

  // Function to refresh user role
  const refreshUserRole = useCallback(async () => {
    if (!supabaseUser) {
      setUserRole(null)
      setUserProfile(null)
      setOrganizationMemberships([])
      return
    }

    const roleFromBackend = await fetchUserRole()
    if (roleFromBackend) {
      setUserRole(roleFromBackend)
    } else {
      // Fallback to metadata if backend not available
      setUserRole(supabaseUser.user_metadata?.role ?? null)
    }
  }, [supabaseUser, fetchUserRole])

  // Log which build/environment is running, once per page load, to make it
  // obvious which code state is actually being tested (dev preview vs. prod, etc.)
  useEffect(() => {
    console.log(
      `[Bürolist] version=${process.env.NEXT_PUBLIC_APP_VERSION ?? 'local'} built=${process.env.NEXT_PUBLIC_BUILD_TIME ?? 'unknown'} api=${getApiBaseUrlOrNull() ?? 'not configured'}`
    )
  }, [])

  useEffect(() => {
    // Only reload when the session has actually expired during a background stay
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const { data } = await supabase.auth.getSession()
        if (!data.session && supabaseUserRef.current) {
          // Session expired while the tab was in the background – reload to clear state
          window.location.reload()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Check active sessions and set the user
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSupabaseUser(session?.user ?? null)

      if (session?.user) {
        if (isResetPasswordRoute) {
          setLoading(false)
          initAuthCompletedRef.current = true
          return
        }
        // Get role from backend, fall back to Supabase metadata on failure
        const roleFromBackend = await fetchUserRole()
        setUserRole(roleFromBackend ?? (session.user.user_metadata?.role ?? null))
        // Allow a microtask tick so userProfile state propagates before we clear loading
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      setLoading(false)
      initAuthCompletedRef.current = true
    }

    initAuth()

    // Listen for changes on auth state (login, logout, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip ALL events during initial load – initAuth handles them
      if (!initAuthCompletedRef.current) return

      const previousUserId = supabaseUserRef.current?.id ?? null
      const nextUserId = session?.user?.id ?? null

      setSupabaseUser(session?.user ?? null)

      // Manche Events (Token-Refresh nach Rueckkehr aus einem gedrosselten
      // Hintergrund-Tab, Metadaten-Updates, Supabases interne
      // _recoverAndRefresh-Events, ...) melden denselben User erneut, ohne
      // dass sich an Rolle/Organisation etwas geaendert hat. Wir pruefen
      // deshalb bewusst die tatsaechliche User-ID statt uns auf den
      // Event-Namen zu verlassen (Supabase feuert dafuer je nach Ausloeser
      // unterschiedliche, teils interne Events) - ein voller Re-Fetch von
      // /auth/me samt globalem Spinner ist nur noetig, wenn sich die
      // Identitaet wirklich aendert. Das vermeidet auch, dass ein
      // zusaetzlicher getSession()-Aufruf direkt nach einem Tab-Wechsel (wenn
      // das Netzwerk gerade erst wieder aufwacht) in den Session-Timeout von
      // authenticatedFetch laeuft.
      if (previousUserId === nextUserId) {
        return
      }

      if (session?.user) {
        if (isResetPasswordRoute) {
          setLoading(false)
          return
        }
        setLoading(true)

        // Get role from backend, fall back to metadata on failure (never force-reload)
        const roleFromBackend = await fetchUserRole()
        setUserRole(roleFromBackend ?? (session.user.user_metadata?.role ?? null))
        setLoading(false)

        await new Promise(resolve => setTimeout(resolve, 0))
      } else {
        setUserRole(null)
        setUserProfile(null)
        setOrganizationMemberships([])
        setLoading(false)
      }
    })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      subscription.unsubscribe()
    }
  }, [supabase, fetchUserRole, isResetPasswordRoute])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, metadata?: { firstName?: string, lastName?: string, role?: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    supabaseUser,
    userProfile,
    loading,
    backendLoading,
    backendRetryCount,
    isAdmin,
    userRole,
    organizationId,
    organization,
    organizationMemberships,
    organizationRole,
    hasOrganization,
    canManageOrganization,
    signIn,
    signUp,
    signOut,
    refreshUserRole,
    refreshOrganizations: fetchOrganizationMemberships,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
