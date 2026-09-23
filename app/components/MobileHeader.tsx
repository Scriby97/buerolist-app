'use client';

import Link from "next/link";
import Image from "next/image";
import { InstallPrompt } from "./InstallPrompt";
import { OrgSwitcher } from "./OrgSwitcher";

// Mobiler Header - bewusst immer dunkel (wie BottomNav), unabhaengig vom Theme.
// Global in layout.tsx via AppChrome gerendert (ausser auf "/", das seinen
// eigenen, tab-state-gebundenen Header behaelt).
export function MobileHeader() {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 bg-zinc-950 border-b border-zinc-800 px-5 py-4 flex items-center justify-between z-50">
      <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
        <Image src="/buerolist-logo-dark.svg" alt="Bürolist" width={26} height={26} />
        <h2 className="text-base font-semibold text-zinc-50">Bürolist</h2>
      </Link>
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
        <div className="shrink-0">
          <InstallPrompt />
        </div>
        <OrgSwitcher onDark />
      </div>
    </div>
  );
}
