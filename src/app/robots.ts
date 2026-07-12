import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/molecule'],
      disallow: ['/api/', '/login', '/molecules', '/settings', '/profile']
    },
    sitemap: 'https://model.chemvault.science/sitemap.xml',
    host: 'https://model.chemvault.science'
  };
}
