import { UserAccountPage } from '@/components/account/UserAccountPage';
import { Header } from '@/components/layout/Header';

export const metadata = {
  title: 'Profile | ChemVault',
  description: 'ChemVault User profile synchronized with Molecule Studio.'
};

export default function ProfilePage() {
  return (
    <>
      <Header />
      <UserAccountPage page="profile" />
    </>
  );
}
