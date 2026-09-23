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

export const metadata: Metadata = {
  title: "Bürolist - Arbeitszeiterfassung",
  description: "Zeiterfassung pro Kunde und Projekt für Handwerksbetriebe",
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
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
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
