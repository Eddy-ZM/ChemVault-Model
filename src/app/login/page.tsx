import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Header } from '@/components/layout/Header';

export const metadata = {
  title: 'Sign in to ChemVault',
  description: 'Optional sign in for saved molecules, history and future cloud features.'
};

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl items-center px-6 py-10">
        <Suspense fallback={<div className="mx-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-card">Loading sign in...</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
