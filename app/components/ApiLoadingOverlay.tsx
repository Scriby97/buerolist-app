'use client'

import { useApiLoading } from '@/lib/api/ApiLoadingContext'

export function ApiLoadingOverlay() {
  const { isLoading } = useApiLoading()

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 flex items-center justify-center">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin"></div>

        {/* Text */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
          Daten werden geladen...
        </p>
      </div>
    </div>
  )
}
