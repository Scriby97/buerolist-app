'use client'

import { useEffect, useState, type FC, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/AuthProvider'

const LoginPage: FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, supabaseUser } = useAuth()
  const t = useTranslations('login')
  const tCommon = useTranslations('common')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRecoveryRedirect, setIsRecoveryRedirect] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // Reine Ableitung aus den URL-Query-Params - useSearchParams() liefert die
  // bereits waehrend des Renders (kein Browser-only-API wie window.location),
  // daher kein useEffect/useState noetig.
  const infoMessage = searchParams.get('message')
    ?? (searchParams.get('registered') === '1' ? t('registeredSuccessMessage') : null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const hash = window.location.hash
    if (hash && hash.includes('type=recovery')) {
      // window.location.hash ist echtes Browser-only-API (server-seitig nicht
      // verfuegbar, taucht auch nie im Server-Response auf) und muss daher
      // zwingend erst nach dem Mount gelesen werden - die eigentliche
      // Zustandsaenderung ist hier untrennbar an die Navigation (router.replace)
      // gekoppelt, ein reiner Render-Ableitung waere nicht moeglich, ohne beim
      // Hydrieren kurzzeitig das falsche UI zu zeigen.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRecoveryRedirect(true)
      router.replace(`/reset-password${hash}`)
    }
  }, [router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        // Nur refresh() statt push()+refresh(): beide loesen sonst je einen
        // eigenen Request durch die Middleware aus, die parallel um die
        // Navigation konkurrieren. Die Middleware leitet bei erkannter Session
        // von /login ohnehin selbst auf / weiter (siehe lib/supabase/middleware.ts).
        //
        // router.refresh() aendert die URL aber erst, wenn der Server-Roundtrip
        // (inkl. Middleware-Redirect) fertig ist - bis dahin steht die Seite
        // noch auf /login. Wuerde man hier loading wieder auf false setzen,
        // wuerde in genau dieser Zwischenzeit kurz das echte Login-Formular
        // aufblitzen, sobald AuthProvider mit dem Laden von Profil/Organisation
        // fertig ist (der globale Splash-Spinner verschwindet dann, obwohl die
        // Navigation noch laeuft). Stattdessen bleibt die Seite bis zum
        // tatsaechlichen Routenwechsel im eigenen Redirect-Spinner (unten).
        setRedirecting(true)
        router.refresh()
        return
      }
    } catch {
      setError(tCommon('unexpectedError'))
      setLoading(false)
    }
  }

  // supabaseUser deckt den Fall ab, dass diese Seite waehrend des Login-
  // Uebergangs neu gemountet wird (BackendLoadingWrapper haengt sie auf
  // Auth-Routen zwar nicht mehr aus, aber ein bereits eingeloggter User, der
  // /login direkt aufruft, soll ebenfalls sofort den Spinner sehen statt kurz
  // das Formular) - bis die Middleware auf / weiterleitet.
  if (isRecoveryRedirect || redirecting || supabaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t('redirecting')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {t('title')}
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-8">
          {infoMessage && (
            <div className="mb-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
              <p className="text-sm text-green-800 dark:text-green-200">{infoMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                {t('emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
                placeholder="deine@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                {t('passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brown-600 hover:bg-brown-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('submitting') : t('submitButton')}
            </button>
          </form>

          <div className="mt-6 border-t border-zinc-200 dark:border-zinc-700 pt-4 flex items-center justify-between">
            <Link
              href="/register"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {t('registerLink')}
            </Link>
            <Link
              href="/reset-password"
              className="text-sm text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {t('forgotPasswordLink')}
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/impressum"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {t('impressumLink')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
