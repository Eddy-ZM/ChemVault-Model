import Link from 'next/link';
import { AuthButton } from '@/components/auth/AuthButton';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3 text-slate-950">
          <img src="/brand/chemvault-logo.png" alt="ChemVault logo" className="h-9 w-9 rounded-md object-contain" />
          <span className="truncate text-sm font-bold tracking-tight sm:text-base">ChemVault Molecule Studio</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex" aria-label="Main navigation">
          <Link href="/molecule" className="transition hover:text-sky-700">
            Molecule Studio
          </Link>
          <a href="https://docs.chemvault.science/manual/molecule-studio/" target="_blank" rel="noopener noreferrer" className="transition hover:text-sky-700">
            Docs
          </a>
          <Link href="/" className="transition hover:text-sky-700">
            About
          </Link>
        </nav>
        <AuthButton />
      </div>
    </header>
  );
}
