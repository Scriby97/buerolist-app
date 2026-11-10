import type { MetadataRoute } from 'next'

const BASE_URL = 'https://buerolistapp.ch'

// Nur die oeffentlich erreichbaren Seiten (siehe app/robots.ts)
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE_URL}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/impressum`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/datenschutz`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
