import Link from 'next/link';
import { Header } from '@/components/layout/Header';

export const metadata = {
  title: 'My Molecules | ChemVault',
  description: 'Saved molecules placeholder.'
};

export default function MoleculesPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-4xl items-center px-6 py-10">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Coming soon</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">My Molecules</h1>
          <p className="mt-3 text-slate-600">Saved molecules, favourites, recent searches and cloud sync will be added after real ChemVault account auth is connected.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login?callbackUrl=/molecules" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Sign in
            </Link>
            <Link href="/molecule" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Open Molecule Studio
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
