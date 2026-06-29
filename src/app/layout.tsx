import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChemVault Molecule Studio',
  description: 'Build and inspect molecules with a modern chemistry interface.',
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
      <body className="min-h-screen bg-gradient-to-br from-chemvault-paper via-indigo-50 to-sky-100 text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
