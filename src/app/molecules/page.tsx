import { UserAccountPage } from '@/components/account/UserAccountPage';
import { Header } from '@/components/layout/Header';

export const metadata = {
  title: 'My Molecules | ChemVault',
  description: 'Molecule library access synchronized with ChemVault User.'
};

export default function MoleculesPage() {
  return (
    <>
      <Header />
      <UserAccountPage page="molecules" />
    </>
  );
}
