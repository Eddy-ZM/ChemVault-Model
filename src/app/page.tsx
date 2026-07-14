import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { DesktopQuantumWelcome } from '@/components/home/DesktopQuantumWelcome';

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="cv-mol-home">
        <section className="cv-mol-hero">
          <div className="cv-mol-hero-copy">
            <p className="cv-mol-kicker">Molecular workspace</p>
            <h1>ChemVault Molecule Studio</h1>
            <p className="cv-mol-lead">
              Prepare molecular structures, validate calculation inputs, run local engines, and keep reproducible records.
            </p>
            <p className="cv-mol-note">
              Web tools support molecule exploration. The Windows desktop app adds local and licensed quantum-engine workflows.
            </p>
            <div className="cv-mol-actions">
              <Link
                href="/molecule"
                className="cv-mol-primary"
              >
                Explore molecules
              </Link>
              <Link
                href="/molecule?workflow=quantum"
                className="cv-mol-secondary"
              >
                Open quantum workspace
              </Link>
            </div>
          </div>
          <div className="cv-mol-hero-image" aria-hidden="true">
            <Image src="/assets/molecular-exhibition.png" alt="" fill priority sizes="(max-width: 900px) 100vw, 54vw" />
          </div>
        </section>
        <DesktopQuantumWelcome />
      </main>
    </>
  );
}
