'use client'

import { useState } from 'react'

// Outlook-Stil: feste, kontrastarme Palette; Auswahl deterministisch aus dem Namen.
const COLORS = [
  '#0f766e', // teal-700
  '#1d4ed8', // blue-700
  '#6d28d9', // violet-700
  '#be123c', // rose-700
  '#b45309', // amber-700
  '#15803d', // green-700
  '#0369a1', // sky-700
  '#9333ea', // purple-600
]

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function colorOf(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

interface OrgAvatarProps {
  name: string
  logoUrl?: string | null
  /** Rendered box size in px. */
  size?: number
  className?: string
}

export function OrgAvatar({ name, logoUrl, size = 36, className = '' }: OrgAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = !!logoUrl && !imgFailed

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {showImage ? (
        // Plain <img>: Logos sind klein und die Supabase-URLs sind nicht in
        // next/image remotePatterns konfiguriert.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl as string}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{ backgroundColor: colorOf(name), fontSize: size * 0.4 }}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  )
}
