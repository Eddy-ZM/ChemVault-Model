import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://model.chemvault.science/',
      changeFrequency: 'monthly',
      priority: 1
    },
    {
      url: 'https://model.chemvault.science/molecule',
      changeFrequency: 'weekly',
      priority: 0.9
    }
  ];
}
