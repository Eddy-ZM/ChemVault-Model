import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Header } from '@/components/layout/Header';
import { LoadingState } from '@/components/ui/LoadingState';

export const metadata = {
  title: 'Sign in to ChemVault',
  description: 'Optional sign in for saved molecules, history and future cloud features.'
};

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="cv-auth-page mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl items-center px-6 py-10">
        <Suspense fallback={<LoginSkeleton />}>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}

function LoginSkeleton() {
  return (
    <div className="cv-auth-card cv-auth-skeleton mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-card" aria-label="Loading sign in">
      <LoadingState label="Loading sign in" description="Preparing ChemVault account options." />
    </div>
  );
}
