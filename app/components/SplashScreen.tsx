'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  isLoading: boolean;
  backendStarting?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export function SplashScreen({
  isLoading,
  backendStarting = false,
  retryCount = 0,
  maxRetries = 8
}: SplashScreenProps) {
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-900 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 px-4">
        {/* Logo */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Image
            src="/buerolist-logo-light.svg"
            alt="Bürolist Logo"
            width={56}
            height={56}
            className="dark:hidden"
            priority
          />
          <Image
            src="/buerolist-logo-dark.svg"
            alt="Bürolist Logo"
            width={56}
            height={56}
            className="hidden dark:block"
            priority
          />
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            Bürolist
          </h1>
        </div>

        {/* Loading Spinner */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-zinc-200 dark:border-zinc-800 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin"></div>
        </div>

        {/* Status Text */}
        <div className="text-center space-y-2 min-h-[60px]">
          {backendStarting && (
            <>
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                Server wird hochgefahren{dots}
              </p>
              {retryCount > 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Versuch {retryCount} von {maxRetries}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
