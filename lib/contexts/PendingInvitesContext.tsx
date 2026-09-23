'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FC, type ReactNode } from 'react'
import { getMyInvites } from '@/lib/api/invites'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { PendingInvite } from '@/lib/types/user'

// Sitzungsweites Flag, ob das Einladungs-Popup schon gezeigt wurde. sessionStorage
// statt state/localStorage, weil es genau das abgestimmte Verhalten liefert: leert
// sich beim Schliessen des Tabs (also wieder sichtbar bei jedem neuen Login), bleibt
// aber ueber Reloads/Navigation innerhalb derselben Sitzung erhalten (nicht bei jeder
// Seite erneut).
const POPUP_SHOWN_KEY = 'buerolist:invitePopupShown'

interface PendingInvitesContextValue {
  pendingInvites: PendingInvite[]
  hasPendingInvites: boolean
  isLoading: boolean
  refresh: () => Promise<void>
  removeInvite: (token: string) => void
  /** Ob das Popup in dieser Sitzung schon (mindestens einmal) gezeigt wurde. */
  popupShownThisSession: boolean
  /** Merkt sich, dass das Popup jetzt gezeigt wurde/wird. */
  markPopupShown: () => void
}

const PendingInvitesContext = createContext<PendingInvitesContextValue | undefined>(undefined)

export const PendingInvitesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { supabaseUser } = useAuth()
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [popupShownThisSession, setPopupShownThisSession] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabaseUser) return
    setIsLoading(true)
    try {
      const invites = await getMyInvites()
      setPendingInvites(invites)
    } catch {
      // Stilles Scheitern - die Einladungs-Uebersicht selbst zeigt bei Bedarf
      // einen eigenen Fehler an, das Popup/Badge ist nur ein Hinweis-Feature.
    } finally {
      setIsLoading(false)
    }
  }, [supabaseUser])

  useEffect(() => {
    if (!supabaseUser) {
      // Abgemeldet (oder noch nicht eingeloggt) - Zustand zuruecksetzen, damit
      // beim naechsten Login wieder frisch geladen und das Popup wieder gezeigt
      // wird. Wichtig: auch den sessionStorage-Eintrag selbst loeschen, nicht
      // nur den React-State - sonst wuerde ein erneuter Login im selben Tab
      // (z.B. Account-Wechsel oder einfach ab-/wieder anmelden ohne den Tab zu
      // schliessen) das alte "schon gezeigt"-Flag wieder einlesen und das
      // Popup faelschlich dauerhaft unterdruecken, obwohl es laut Vorgabe bei
      // jedem neuen Login wieder erscheinen soll.
      setPendingInvites([])
      setPopupShownThisSession(false)
      try {
        sessionStorage.removeItem(POPUP_SHOWN_KEY)
      } catch {
        // siehe unten
      }
      return
    }

    try {
      setPopupShownThisSession(sessionStorage.getItem(POPUP_SHOWN_KEY) === '1')
    } catch {
      // sessionStorage kann in seltenen Faellen nicht verfuegbar sein (z.B.
      // privater Modus mit Restriktionen) - dann zeigen wir das Popup einfach
      // bei jedem Laden, statt hart zu scheitern.
    }

    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseUser])

  const removeInvite = useCallback((token: string) => {
    setPendingInvites((prev) => prev.filter((invite) => invite.token !== token))
  }, [])

  const markPopupShown = useCallback(() => {
    setPopupShownThisSession(true)
    try {
      sessionStorage.setItem(POPUP_SHOWN_KEY, '1')
    } catch {
      // siehe oben
    }
  }, [])

  const value = useMemo<PendingInvitesContextValue>(
    () => ({
      pendingInvites,
      hasPendingInvites: pendingInvites.length > 0,
      isLoading,
      refresh,
      removeInvite,
      popupShownThisSession,
      markPopupShown,
    }),
    [pendingInvites, isLoading, refresh, removeInvite, popupShownThisSession, markPopupShown]
  )

  return <PendingInvitesContext.Provider value={value}>{children}</PendingInvitesContext.Provider>
}

export function usePendingInvites(): PendingInvitesContextValue {
  const ctx = useContext(PendingInvitesContext)
  if (!ctx) {
    throw new Error('usePendingInvites must be used within a PendingInvitesProvider')
  }
  return ctx
}
