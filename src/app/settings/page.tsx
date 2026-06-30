import { UserAccountPage } from '@/components/account/UserAccountPage';
import { Header } from '@/components/layout/Header';

export const metadata = {
  title: 'Settings | ChemVault',
  description: 'ChemVault User settings synchronized with Molecule Studio.'
};

export default function SettingsPage() {
  return (
    <>
      <Header />
      <UserAccountPage page="settings" />
    </>
  );
}
