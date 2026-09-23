'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { SplashScreen } from './SplashScreen'

export function BackendLoadingWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { loading, backendLoading, backendRetryCount, supabaseUser, userProfile, refreshUserRole, signOut } = useAuth()
  const [retrying, setRetrying] = useState(false)

  // Auf /login und /register bringt die Seite ihre eigene Uebergangs-UI mit
  // (der kleine Redirect-Spinner in login/page.tsx). Der globale Splash wuerde
  // dort nach dem Klick auf "Anmelden" nur das ganze Layout uebernehmen - und
  // weil er die Seite dabei aus- und danach wieder einhaengt, blitzt beim
  // Zurueckschalten kurz das Login-Formular auf (der frisch gemountete
  // LoginPage hat seinen redirecting-State verloren, die Route steht wegen des
  // noch laufenden router.refresh() aber weiterhin auf /login). Deshalb: auf
  // diesen Routen keinen Splash, kein Profil-Fehler-Overlay - die Seite bleibt
  // durchgehend gemountet und steuert ihren Spinner selbst. Einzige Ausnahme
  // ist ein echter Backend-Kaltstart, dessen "Server wird hochgefahren"-Hinweis
  // auch hier sinnvoll ist.
  const isAuthRoute = pathname === '/login' || pathname === '/register'
  const backendStarting = backendLoading && backendRetryCount > 0

  // Show splash screen when:
  // 1. Initial loading (auth check)
  // 2. Backend is being started (health check retries)
  const showSplash = (loading || backendLoading) && (!isAuthRoute || backendStarting)

  // A session exists but the profile fetch failed (e.g. /auth/me returned 401/500).
  // Never fall through to rendering the app in this state - we don't actually know
  // who the user is or whether they belong to an organization.
  const profileLoadFailed = !loading && !isAuthRoute && !!supabaseUser && !userProfile

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await refreshUserRole()
    } finally {
      setRetrying(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Unified Splash Screen */}
      <SplashScreen
        isLoading={showSplash}
        backendStarting={backendStarting}
        retryCount={backendRetryCount}
        maxRetries={8}
      />

      {!loading && profileLoadFailed && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
          <div className="max-w-md w-full text-center bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-8">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Profil konnte nicht geladen werden</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Deine Sitzung konnte nicht verifiziert werden. Bitte versuche es erneut oder melde dich neu an.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full py-2.5 px-4 bg-brown-600 hover:bg-brown-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {retrying ? 'Wird erneut versucht...' : 'Erneut versuchen'}
              </button>
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 px-4 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium rounded-lg transition-colors"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auf Auth-Routen immer rendern (die Seite steuert ihren eigenen
          Spinner); sonst erst, wenn das Laden fertig und das Profil bekannt ist. */}
      {(isAuthRoute || (!loading && !profileLoadFailed)) && children}
    </>
  )
}
