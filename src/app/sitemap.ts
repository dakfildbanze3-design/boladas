import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://boladas.vercel.app/',
      lastModified: new Date('2026-01-12'),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
