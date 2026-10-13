'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Wird vom Inline-Script in app/layout.tsx gesetzt, das beforeinstallprompt
// schon vor dem Hydrieren abfaengt (das Event kommt nur einmal und oft, bevor
// diese Komponente gemountet ist - z.B. direkt nach einem Neuladen).
declare global {
  interface Window {
    __deferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const syncFromWindow = () => {
      const captured = window.__deferredInstallPrompt ?? null;
      setDeferredPrompt(captured);
      setIsInstallable(Boolean(captured) || (!isStandalone && isIOS));
    };

    // Bereits (vor dem Mount) abgefangenes Event uebernehmen und auf spaetere
    // Aenderungen (Event kommt doch noch / App wurde installiert) reagieren.
    // Bewusst per Effect (nicht als useState-Lazy-Initializer): der Server
    // rendert immer isInstallable=false (kein window/navigator dort), ein
    // Lazy-Initializer verursachte einen Hydration-Mismatch.
    syncFromWindow();
    window.addEventListener('installpromptchange', syncFromWindow);

    return () => window.removeEventListener('installpromptchange', syncFromWindow);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('iOS: Tippe auf das Teilen-Symbol und wähle "Zum Home-Bildschirm"');
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    // Ein beforeinstallprompt-Event laesst sich nur einmal verwenden.
    // Auch nach "Abbrechen" ausblenden - ohne Event wuerde ein weiterer Klick
    // sonst nur den iOS-Hinweis zeigen. Bietet Chrome die Installation spaeter
    // erneut an, blendet installpromptchange den Button wieder ein.
    window.__deferredInstallPrompt = null;
    setIsInstallable(false);
    setDeferredPrompt(null);
  };

  if (!isInstallable) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center gap-2 px-4 py-2 bg-brown-600 hover:bg-brown-700 text-white rounded-lg transition-colors text-sm font-medium"
      aria-label="App installieren"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
      <span className="hidden sm:inline">App installieren</span>
    </button>
  );
}
