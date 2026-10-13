import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { OrganizationProvider } from "@/lib/contexts/OrganizationContext";
import { PendingInvitesProvider } from "@/lib/contexts/PendingInvitesContext";
import { BackendLoadingWrapper } from "./components/BackendLoadingWrapper";
import { InvitePopup } from "./components/InvitePopup";
import { PastDueSubscriptionBanner } from "./components/PastDueSubscriptionBanner";
import { AppChrome } from "./components/AppChrome";
import { ApiLoadingProvider } from "@/lib/api/ApiLoadingContext";
import { ApiLoadingOverlay } from "./components/ApiLoadingOverlay";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";
import { ThemeManager } from "./components/ThemeManager";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const plexSansCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-sans-condensed",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#1b2126",
};

// Absolute Basis-URL fuer Open-Graph-Bilder (WhatsApp & Co. brauchen absolute
// URLs). VERCEL_PROJECT_PRODUCTION_URL setzt Vercel automatisch beim Build.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const siteDescription = "Arbeitszeiterfassung pro Kunde und Projekt für Handwerksbetriebe";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Bürolist - Arbeitszeiterfassung",
  description: siteDescription,
  // Link-Vorschau beim Teilen (WhatsApp, Teams, Mail ...) - z.B. ueber
  // "App teilen" in der Mitarbeiterverwaltung.
  openGraph: {
    type: "website",
    siteName: "Bürolist",
    title: "Bürolist",
    description: siteDescription,
    url: "/",
    locale: "de_CH",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Bürolist" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bürolist",
    description: siteDescription,
    images: ["/og-image.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bürolist",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192x192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

const INSTALL_PROMPT_CAPTURE_SCRIPT = `
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  window.dispatchEvent(new Event('installpromptchange'));
});
window.addEventListener('appinstalled', function () {
  window.__deferredInstallPrompt = null;
  window.dispatchEvent(new Event('installpromptchange'));
});
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        {/* Chrome feuert beforeinstallprompt nur einmal, sehr frueh beim
            Laden - oft bevor InstallPrompt gemountet ist (z.B. waehrend die
            Anmeldung noch laedt). Daher hier vor React abfangen und global
            ablegen; InstallPrompt liest es von dort. */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_CAPTURE_SCRIPT }} />
      </head>
      <body
        className={`${plexSans.variable} ${plexSansCondensed.variable} ${plexMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <ServiceWorkerRegistration />
          <ThemeManager />
          <ApiLoadingProvider>
            <ApiLoadingOverlay />
            <AuthProvider>
              <OrganizationProvider>
                <BackendLoadingWrapper>
                  <PendingInvitesProvider>
                    <InvitePopup />
                    <PastDueSubscriptionBanner />
                    <AppChrome />
                    {children}
                  </PendingInvitesProvider>
                </BackendLoadingWrapper>
              </OrganizationProvider>
            </AuthProvider>
          </ApiLoadingProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
