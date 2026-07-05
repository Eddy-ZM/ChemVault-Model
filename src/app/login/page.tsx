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
        <Suspense fallback={<LoginSkeleton />}>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}

function LoginSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-card" aria-label="Loading sign in">
      <div className="skeleton h-3 w-36 rounded" />
      <div className="skeleton mt-5 h-9 w-72 rounded" />
      <div className="skeleton mt-4 h-4 w-full rounded" />
      <div className="mt-6 grid gap-2">
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton h-12 rounded-xl" />
      </div>
      <div className="skeleton mt-6 h-52 rounded-2xl" />
    </div>
  );
}
