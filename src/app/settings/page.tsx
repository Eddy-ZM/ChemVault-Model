import Link from 'next/link';
import { Header } from '@/components/layout/Header';

export const metadata = {
  title: 'Settings | ChemVault',
  description: 'ChemVault settings placeholder.'
};

export default function SettingsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-4xl items-center px-6 py-10">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Coming soon</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Settings</h1>
          <p className="mt-3 text-slate-600">Preferences and account-linked Molecule Studio settings will be available once the production auth backend is connected.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login?callbackUrl=/settings" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
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
