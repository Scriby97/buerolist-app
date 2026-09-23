'use client';

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import CreateTimeEntry from "./components/createTimeEntry";
import MyEntries from "./components/timeEntries";
import Customers from "./components/customers";
import UserMenu from "./components/UserMenu";
import { OrgSwitcher } from "./components/OrgSwitcher";
import { BottomNav } from "./components/BottomNav";
import { MobileHeader } from "./components/MobileHeader";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { InstallPrompt } from "./components/InstallPrompt";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type MenuKey = "erfassen" | "eintraege" | "kunden";

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("nav");
  const [active, setActive] = useState<MenuKey>("erfassen");
  const { userProfile, hasOrganization } = useAuth();
  const { selectedOrgId } = useOrganization();

  // Über die Nav (Tabs, Logo) - im Unterschied zum direkten Auswählen eines
  // Kunden/Projekts in der Kunden-Uebersicht - immer sauber navigieren: ein
  // evtl. noch in der URL stehender ?customerId=/?projectId= (von einer
  // zuvor offenen Detailansicht) wird entfernt, damit der Kunden-Tab beim
  // erneuten Öffnen wieder mit der Liste startet statt mit dem alten Detail.
  const goToTab = (key: MenuKey) => {
    setActive(key);
    if (searchParams.get('customerId') || searchParams.get('projectId')) {
      router.replace(pathname);
    }
  };

  useEffect(() => {
    if (userProfile && !hasOrganization) {
      router.replace('/onboarding');
    }
  }, [userProfile, hasOrganization, router]);

  // Beim Wechsel der Organisation zurück auf "Zeit erfassen" springen - der
  // erste Durchlauf (initiales Laden der gespeicherten Auswahl, null -> erste
  // Org) zählt bewusst nicht als Wechsel. Siehe FleetTracks app/page.tsx.
  const previousOrgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previousOrgId = previousOrgIdRef.current;
    previousOrgIdRef.current = selectedOrgId;
    if (previousOrgId !== null && selectedOrgId !== null && selectedOrgId !== previousOrgId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- s.o.
      setActive("erfassen");
    }
  }, [selectedOrgId]);

  if (userProfile && !hasOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t("redirectingToOnboarding")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black font-sans">
      {/* Left menu - Hidden on mobile */}
      <aside className="hidden md:flex md:w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0b0b0b] px-6 py-8 flex-col h-screen sticky top-0">
        <div className="mb-8 flex-shrink-0 space-y-3">
          <button
            type="button"
            onClick={() => goToTab("erfassen")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Image src="/buerolist-logo-light.svg" alt="Bürolist" width={32} height={32} className="dark:hidden" />
            <Image src="/buerolist-logo-dark.svg" alt="Bürolist" width={32} height={32} className="hidden dark:block" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Bürolist</h2>
          </button>
          <OrgSwitcher />
        </div>

        <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
          <button
            onClick={() => goToTab("erfassen")}
            className={
              "text-left px-4 py-3 rounded-md transition-colors " +
              (active === "erfassen"
                ? "bg-foreground text-background font-medium"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900")
            }
          >
            {t("createTimeEntry")}
          </button>

          <button
            onClick={() => goToTab("eintraege")}
            className={
              "text-left px-4 py-3 rounded-md transition-colors " +
              (active === "eintraege"
                ? "bg-foreground text-background font-medium"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900")
            }
          >
            {t("myEntries")}
          </button>

          <button
            onClick={() => goToTab("kunden")}
            className={
              "text-left px-4 py-3 rounded-md transition-colors " +
              (active === "kunden"
                ? "bg-foreground text-background font-medium"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-900")
            }
          >
            {t("customersOverview")}
          </button>
        </nav>

        {/* User Menu at bottom */}
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3 flex-shrink-0">
          <InstallPrompt />
          <UserMenu />
        </div>
      </aside>

      <MobileHeader />

      {/* Main content */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-10 pt-20 md:pt-10 pb-24 md:pb-10">
        {active === "erfassen" && <CreateTimeEntry onNavigateToAddProject={() => goToTab("kunden")} />}
        {active === "eintraege" && <MyEntries />}
        {active === "kunden" && <Customers />}
      </main>

      <BottomNav active={active} onNavigate={goToTab} />
    </div>
  );
}
