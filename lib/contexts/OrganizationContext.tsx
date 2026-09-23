'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { getAllOrganizations } from '@/lib/api/organizations';
import type { Organization, OrganizationRole } from '@/lib/types/user';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';

const SELECTED_ORG_STORAGE_KEY = 'buerolist:selectedOrgId';

interface OrganizationContextType {
  organizations: Organization[];
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  // Rolle des Users in der AKTUELL AUSGEWÄHLTEN Organisation (nicht in der ersten
  // Mitgliedschaft) - null für globale Administratoren (die keine eigene
  // Mitgliedschaft brauchen) oder falls (noch) keine Organisation ausgewählt ist.
  selectedOrganizationRole: OrganizationRole | null;
  // isAdmin (global, Entwickler-Account) ODER admin/owner in der ausgewählten
  // Organisation - für UI-Gating (Kunden/Projekte anlegen, Kategorien
  // verwalten, etc.), das auf die AKTUELL AUSGEWÄHLTE Organisation reagieren
  // muss, nicht auf die erste Mitgliedschaft.
  canManageSelectedOrganization: boolean;
  isLoading: boolean;
  error: string | null;
  // Laedt die Organisationsliste neu - fuer normale User genuegt
  // AuthProvider.refreshOrganizations() (aktualisiert organizationMemberships,
  // von dem "organizations" unten abgeleitet wird), aber fuer globale
  // Administratoren wird "organizations" NICHT davon abgeleitet, sondern
  // einmalig separat ueber getAllOrganizations() geladen (s.u.) - ohne diese
  // Funktion wuerden Aenderungen, die ein Admin an einer Organisation
  // vornimmt (z.B. eigenes Logo als Owner), nach dem Speichern nicht sichtbar
  // werden, bis die Seite neu geladen wird. Konsumenten, die nach einer
  // Mutation "organizations"/"selectedOrg" aktuell sehen muessen, sollten
  // diese Funktion statt AuthProvider.refreshOrganizations() direkt aufrufen.
  refetchOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { isAdmin, organizationId, organizationMemberships, loading: authLoading, refreshOrganizations: refreshAuthOrganizations } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  // Startet bewusst auf true (nicht false) - Konsumenten mit einem
  // Redirect-Guard (z.B. admin/users/page.tsx) muessen abwarten koennen, bis
  // die mehrstufige Ableitung organizationMemberships -> organizations ->
  // selectedOrgId tatsaechlich durchgelaufen ist, statt mit dem initialen
  // Default (false/null) einen falschen canManageSelectedOrganization=false
  // zu sehen und faelschlich wegzuleiten (siehe Bugreport: /admin/users
  // leitete Owner/Admin bei jedem frischen Seitenaufruf faelschlich auf '/'
  // um, weil authLoading schneller false wurde als diese Ableitung fertig war).
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const getApiErrorMessage = useApiErrorMessage();
  // Use a ref so loading once doesn't add itself to the effect dependency array
  const hasLoadedRef = useRef(false);

  // Persist the user's choice so it survives reloads, and so the sidebar/menu
  // switcher stays in sync with every component reading from this context.
  const setSelectedOrgId = useCallback((id: string | null) => {
    setSelectedOrgIdState(id);
    try {
      if (id) {
        window.localStorage.setItem(SELECTED_ORG_STORAGE_KEY, id);
      } else {
        window.localStorage.removeItem(SELECTED_ORG_STORAGE_KEY);
      }
    } catch {
      // localStorage nicht verfügbar (z.B. Private Mode) - Auswahl gilt dann nur für diese Sitzung
    }
  }, []);

  // Administratoren (Entwickler-Accounts): alle Organisationen system-weit laden,
  // unabhängig von eigenen Mitgliedschaften (Administratoren müssen keiner
  // Organisation angehören, um auf sie zugreifen zu können).
  const loadAdminOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orgs = await getAllOrganizations();
      setOrganizations(orgs);
      setSelectedOrgIdState((current) => {
        if (current) return current;

        let stored: string | null = null;
        try {
          stored = window.localStorage.getItem(SELECTED_ORG_STORAGE_KEY);
        } catch {
          // ignore
        }
        if (stored && orgs.some((org) => org.id === stored)) {
          return stored;
        }

        return orgs[0]?.id ?? null;
      });
    } catch (err) {
      console.error('Fehler beim Laden der Organisationen:', err);
      setError(getApiErrorMessage(err, 'Fehler beim Laden der Organisationen'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadAdminOrganizations();
  }, [isAdmin, loadAdminOrganizations]);

  // Einheitlicher Refresh-Einstiegspunkt fuer Konsumenten (s. Kommentar am
  // Typ oben): Admins bekommen ihre separat geladene All-Orgs-Liste neu
  // geladen, normale User laufen ueber den bestehenden
  // organizationMemberships-Ableitungspfad.
  const refetchOrganizations = useCallback(async () => {
    if (isAdmin) {
      await loadAdminOrganizations();
    } else {
      await refreshAuthOrganizations();
    }
  }, [isAdmin, loadAdminOrganizations, refreshAuthOrganizations]);

  // Normale User: eigene Organisation(en) direkt aus den bereits geladenen
  // Memberships übernehmen - kein zusätzlicher API-Call nötig, und reagiert
  // automatisch, wenn der User eine weitere Organisation erstellt/annimmt.
  useEffect(() => {
    if (isAdmin) return;
    const ownOrganizations = organizationMemberships
      .map((membership) => membership.organization)
      .filter((org): org is Organization => Boolean(org));
    setOrganizations(ownOrganizations);
  }, [isAdmin, organizationMemberships]);

  // Normale User: Auswahl bestimmen/validieren - bevorzugt die zuletzt gewählte
  // (persistierte) Organisation, sonst die erste eigene Mitgliedschaft. Fällt
  // automatisch zurück, falls die bisherige Auswahl keine Mitgliedschaft mehr ist.
  useEffect(() => {
    if (isAdmin || organizations.length === 0) return;

    setSelectedOrgIdState((current) => {
      if (current && organizations.some((org) => org.id === current)) {
        return current;
      }

      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(SELECTED_ORG_STORAGE_KEY);
      } catch {
        // ignore
      }
      if (stored && organizations.some((org) => org.id === stored)) {
        return stored;
      }

      return organizationId ?? organizations[0].id;
    });
  }, [isAdmin, organizations, organizationId]);

  // Normale User: isLoading auf false setzen, sobald die obige Ableitung
  // tatsaechlich abgeschlossen ist - entweder eine Organisation ausgewaehlt
  // wurde, oder feststeht, dass der User keine hat. WICHTIG: erst NACH
  // authLoading auswerten - organizationMemberships startet selbst bei einem
  // User mit Organisationen als leeres Array (bevor AuthProvider ueberhaupt
  // gefetcht hat), war also faelschlich als "User hat keine Organisation"
  // interpretierbar und hat isLoading zu frueh auf false gesetzt (siehe
  // Bugreport: /admin/users leitete Owner/Admin faelschlich auf '/' um).
  // authLoading=false garantiert, dass organizationMemberships bereits
  // verlaesslich ist (AuthProvider.initAuth wartet fetchOrganizationMemberships()
  // vor dem Setzen von loading=false ab).
  useEffect(() => {
    if (isAdmin || authLoading) return;
    if (organizationMemberships.length === 0 || selectedOrgId) {
      setIsLoading(false);
    }
  }, [isAdmin, authLoading, organizationMemberships, selectedOrgId]);

  const selectedMembership = organizationMemberships.find(
    (membership) => membership.organizationId === selectedOrgId,
  );
  const selectedOrganizationRole = selectedMembership?.role ?? null;
  const canManageSelectedOrganization =
    isAdmin ||
    selectedOrganizationRole === 'admin' ||
    selectedOrganizationRole === 'owner';

  return (
    <OrganizationContext.Provider value={{
      organizations,
      selectedOrgId,
      setSelectedOrgId,
      selectedOrganizationRole,
      canManageSelectedOrganization,
      isLoading,
      error,
      refetchOrganizations,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
