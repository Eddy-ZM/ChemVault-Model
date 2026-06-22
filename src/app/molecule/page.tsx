import type { Metadata } from 'next';
import { MoleculeStudio } from '@/components/molecule/MoleculeStudio';

const title = 'ChemVault Molecule Studio';
const description = 'Search, visualise and analyse molecules in 3D with ChemVault.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    siteName: 'ChemVault Molecule Studio',
    url: 'https://model.chemvault.science/molecule'
  }
};

export default function MoleculePage() {
  return <MoleculeStudio />;
}
