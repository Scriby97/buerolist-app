import type { MetadataRoute } from 'next'

// Fast die ganze App liegt hinter dem Login (lib/supabase/middleware.ts). Fuer
// Crawler ohne Session ist jede gesperrte Route nur ein Redirect auf /login,
// darum bewusst kein "Disallow" - gleiches Vorgehen wie bei FleetTrack.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://buerolistapp.ch/sitemap.xml',
  }
}
