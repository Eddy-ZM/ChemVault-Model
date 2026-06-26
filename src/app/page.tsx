import Link from 'next/link';
import { Header } from '@/components/layout/Header';

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl flex-col items-center justify-center px-6 py-10">
        <section className="w-full rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-card">
          <h1 className="text-2xl font-bold text-chemvault-ink md:text-4xl">ChemVault Molecule Studio</h1>
          <p className="mt-4 text-slate-600">
            Draw, search, upload and visualise molecules in 2D and 3D.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Choose one input workflow on the left, then inspect the output on the right.
          </p>
          <div className="mt-6">
            <Link
              href="/molecule"
              className="inline-flex rounded-lg bg-chemvault-accent px-5 py-3 font-medium text-white transition hover:opacity-90"
            >
              Open Studio
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
