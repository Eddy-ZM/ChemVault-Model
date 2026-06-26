import Link from 'next/link';
import { Header } from '@/components/layout/Header';

export const metadata = {
  title: 'Profile | ChemVault',
  description: 'ChemVault profile placeholder.'
};

export default function ProfilePage() {
  return <ComingSoonPage title="Profile" description="Account profile management will connect to ChemVault User in a later release." />;
}

function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-4xl items-center px-6 py-10">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Coming soon</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">{title}</h1>
          <p className="mt-3 text-slate-600">{description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
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
