'use client';

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type MenuKey = "erfassen" | "eintraege" | "kunden";

interface BottomNavProps {
  // Nur relevant, wenn die BottomNav auf "/" gerendert wird: steuert, welcher
  // der drei Haupt-Tabs aktuell hervorgehoben ist, und onNavigate wechselt
  // dort nur den lokalen Tab-State (kein Routenwechsel). Fehlt onNavigate
  // (Aufruf ausserhalb von "/", z.B. von Settings/Admin-Seiten via
  // AppChrome), navigiert ein Klick auf einen Haupt-Tab stattdessen wirklich
  // zu "/" (landet dort auf dem Standard-Tab "Zeit erfassen").
  active?: MenuKey;
  onNavigate?: (key: MenuKey) => void;
}

// Untere Tab-Leiste fuer Mobile - analog zu FleetTracks BottomNav, gleiches
// Farbschema (immer Navy/dunkel in beiden Themes). "Konto" ist keine der drei
// In-Page-Tabs, sondern navigiert auf die bestehende /settings-Route. Der
// "Kunden"-Tab ist fuer alle Mitglieder sichtbar (nicht nur Admin/Owner) -
// anders als FleetTracks "Flotte"-Tab, weil auch Mitarbeiter Kunden/Projekte
// zum Buchen sehen koennen muessen; das Anlegen bleibt Admin/Owner
// vorbehalten (siehe Kunden-Tab-Inhalt selbst).
export function BottomNav({ active, onNavigate }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const accountActive = pathname.startsWith("/settings") || pathname.startsWith("/admin");

  const handleTabClick = (key: MenuKey) => {
    if (onNavigate) {
      onNavigate(key);
    } else {
      router.push("/");
    }
  };

  const itemClass = (isActive: boolean) =>
    `flex flex-col items-center gap-1 py-1.5 px-3 ${isActive ? "text-brown-600" : "text-zinc-400"}`;
  const labelClass = (isActive: boolean) =>
    `text-[10px] tracking-wide ${isActive ? "font-semibold" : "font-medium"}`;

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-zinc-950 border-t border-zinc-800 flex items-stretch justify-between px-2 pt-1.5"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      <button type="button" onClick={() => handleTabClick("erfassen")} className={itemClass(active === "erfassen" && !accountActive)}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        <span className={labelClass(active === "erfassen" && !accountActive)}>{t("tabTimeEntry")}</span>
      </button>

      <button type="button" onClick={() => handleTabClick("eintraege")} className={itemClass(active === "eintraege" && !accountActive)}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        <span className={labelClass(active === "eintraege" && !accountActive)}>{t("tabMyEntries")}</span>
      </button>

      <button type="button" onClick={() => handleTabClick("kunden")} className={itemClass(active === "kunden" && !accountActive)}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3" />
          <path d="M21 20c0-2.8-1.9-5.1-4.5-5.8" />
        </svg>
        <span className={labelClass(active === "kunden" && !accountActive)}>{t("tabCustomers")}</span>
      </button>

      <button type="button" onClick={() => router.push("/settings")} className={itemClass(accountActive)}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        <span className={labelClass(accountActive)}>{t("tabAccount")}</span>
      </button>
    </nav>
  );
}
