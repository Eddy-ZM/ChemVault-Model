import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { DesktopQuantumWelcome } from '@/components/home/DesktopQuantumWelcome';

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl flex-col justify-center px-6 py-10">
        <section className="w-full py-8 text-center">
          <h1 className="text-2xl font-bold text-chemvault-ink md:text-4xl">ChemVault Molecule Studio</h1>
          <p className="mt-4 text-slate-600">
            Prepare molecular structures, validate calculation inputs, run local engines, and keep reproducible records.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Web tools support molecule exploration. The Windows desktop app adds local and licensed quantum-engine workflows.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/molecule"
              className="inline-flex rounded-lg bg-chemvault-accent px-5 py-3 font-medium text-white transition hover:opacity-90"
            >
              Explore molecules
            </Link>
            <Link
              href="/molecule?workflow=quantum"
              className="inline-flex rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-800 transition hover:border-sky-400 hover:text-sky-800"
            >
              Open quantum workspace
            </Link>
          </div>
          <DesktopQuantumWelcome />
        </section>
      </main>
    </>
  );
}
