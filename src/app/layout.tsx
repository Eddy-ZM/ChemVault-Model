import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { DesktopUpdateGate } from '@/components/home/DesktopUpdateGate';
import './globals.css';
import './exhibition-theme.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://model.chemvault.science'),
  title: {
    default: 'ChemVault Molecule Studio',
    template: '%s | ChemVault Molecule Studio'
  },
  description: 'Search, draw, import, visualise and export molecular structures in 2D and 3D with optional professional desktop quantum workflows.',
  applicationName: 'ChemVault Molecule Studio',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ChemVault Molecule Studio',
    title: 'ChemVault Molecule Studio',
    description: 'Molecular search, drawing, 3D visualisation, exports and professional Windows quantum workflows.',
    images: [{ url: '/assets/favicon-512.png', width: 512, height: 512, alt: 'ChemVault Molecule Studio' }]
  },
  twitter: {
    card: 'summary',
    title: 'ChemVault Molecule Studio',
    description: 'Molecular search, drawing, 3D visualisation and professional desktop quantum workflows.',
    images: ['/assets/favicon-512.png']
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/assets/favicon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/assets/favicon.svg', type: 'image/svg+xml' }
    ],
    apple: '/assets/chemvault-apple-touch-icon.png'
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-chemvault-paper text-slate-900">
        <AuthProvider>
          {children}
          <DesktopUpdateGate />
        </AuthProvider>
      </body>
    </html>
  );
}
