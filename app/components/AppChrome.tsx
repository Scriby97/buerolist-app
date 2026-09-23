'use client';

import { usePathname } from 'next/navigation';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';

// Routen ohne mobile Chrome: "/" rendert Header+BottomNav bereits selbst
// (tab-state-gebunden), oeffentliche Routen haben keinen eingeloggten User,
// "/onboarding" hat noch keine Organisation - die BottomNav-Tabs wuerden
// sofort wieder per router.push("/") zurueck auf "/onboarding" bouncen.
const EXCLUDED_PREFIXES = ['/login', '/register', '/reset-password', '/impressum', '/onboarding'];

/**
 * Rendert den mobilen Header + die BottomNav global fuer alle eingeloggten
 * App-Seiten ausserhalb von "/" (z.B. Settings, Admin) - selbst-steuernd
 * anhand der Route, einmal in layout.tsx gerendert (gleiches Muster wie
 * InvitePopup/PastDueSubscriptionBanner).
 */
export function AppChrome() {
  const pathname = usePathname();

  if (pathname === '/' || EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <>
      <MobileHeader />
      <BottomNav />
    </>
  );
}
