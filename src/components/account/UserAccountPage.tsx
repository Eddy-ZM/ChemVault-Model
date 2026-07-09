'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthUser, useAuth, userApiUrl } from '@/components/auth/AuthProvider';
import { LoadingState } from '@/components/ui/LoadingState';
import { UserPortalSection, buildRegisterUrl, buildUserPortalUrl } from '@/lib/auth/chemvaultUserLinks';
import { loadQuantumHistory, type QuantumHistoryEntry } from '@/lib/chem/quantumWorkflow';

export type AccountPage = 'profile' | 'molecules' | 'settings';

type AccountPageMeta = {
  title: string;
  eyebrow: string;
  description: string;
  path: Route;
  portalSection: UserPortalSection;
};

type MoleculeEntitlements = {
  authenticated?: boolean;
  membershipTier?: string | null;
  permissions?: string[];
  featureFlags?: Record<string, boolean | null | undefined> | null;
  quota?: {
    searchesRemaining?: number | null;
    exportsRemaining?: number | null;
    savedProjectsRemaining?: number | null;
  } | null;
};

const pageMeta: Record<AccountPage, AccountPageMeta> = {
  profile: {
    title: 'Profile',
    eyebrow: 'ChemVault User profile',
    description: 'View the identity, role, services and page access currently synced from ChemVault User.',
    path: '/profile',
    portalSection: 'profile'
  },
  molecules: {
    title: 'My Molecules',
    eyebrow: 'Molecule library',
    description: 'Review molecule workspace availability, cloud-library entitlement and saved-project quota from ChemVault User.',
    path: '/molecules',
    portalSection: 'molecules'
  },
  settings: {
    title: 'Settings',
    eyebrow: 'Account settings',
    description: 'Manage Molecule Studio account access through ChemVault User and review local web app configuration.',
    path: '/settings',
    portalSection: 'settings'
  }
};

const accountTabs: Array<{ page: AccountPage; label: string; href: Route }> = [
  { page: 'profile', label: 'Profile', href: '/profile' },
  { page: 'molecules', label: 'My Molecules', href: '/molecules' },
  { page: 'settings', label: 'Settings', href: '/settings' }
];

export function UserAccountPage({ page }: { page: AccountPage }) {
  const meta = pageMeta[page];
  const { ready, loading, refresh, signOut, user, userOrigin } = useAuth();
  const [entitlements, setEntitlements] = useState<MoleculeEntitlements | null>(null);
  const [entitlementsLoading, setEntitlementsLoading] = useState(false);
  const [entitlementsError, setEntitlementsError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [localQuantumHistory, setLocalQuantumHistory] = useState<QuantumHistoryEntry[]>([]);

  const fetchEntitlements = useCallback(async () => {
    if (!user) {
      setEntitlements(null);
      setEntitlementsError(null);
      return;
    }

    setEntitlementsLoading(true);
    try {
      const response = await fetch(userApiUrl('/api/apps/molecule/permissions'), {
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`Permissions sync failed with ${response.status}.`);
      const payload = (await response.json()) as MoleculeEntitlements;
      setEntitlements({
        ...payload,
        permissions: normalizePermissions(payload.permissions)
      });
      setEntitlementsError(null);
      setLastSyncedAt(new Date());
    } catch (error) {
      setEntitlements(null);
      setEntitlementsError(error instanceof Error ? error.message : 'Permissions sync is unavailable.');
    } finally {
      setEntitlementsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setEntitlements(null);
      setEntitlementsError(null);
      setLastSyncedAt(null);
      return;
    }

    setLastSyncedAt((current) => current ?? new Date());
    void fetchEntitlements();
  }, [fetchEntitlements, ready, user]);

  useEffect(() => {
    setLocalQuantumHistory(loadQuantumHistory());
  }, [page]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await refresh();
      setLastSyncedAt(new Date());
      await fetchEntitlements();
    } finally {
      setSyncing(false);
    }
  };

  const registerUrl = buildRegisterUrl({ userOrigin, callbackPath: meta.path });
  const userPortalUrl = buildUserPortalUrl(meta.portalSection, { userOrigin, callbackPath: meta.path });
  const securityUrl = buildUserPortalUrl('security', { userOrigin, callbackPath: meta.path });
  const settingsUrl = buildUserPortalUrl('settings', { userOrigin, callbackPath: meta.path });
  const profileUrl = buildUserPortalUrl('profile', { userOrigin, callbackPath: meta.path });
  const moleculesUrl = buildUserPortalUrl('molecules', { userOrigin, callbackPath: meta.path });
  const loginHref = `/login?callbackUrl=${meta.path}` as Route;

  const permissions = useMemo(() => {
    const fromEntitlements = normalizePermissions(entitlements?.permissions);
    return fromEntitlements.length ? fromEntitlements : normalizePermissions(user?.permissions);
  }, [entitlements?.permissions, user?.permissions]);

  const membershipTier = entitlements?.membershipTier || user?.membershipTier || user?.role || 'Free';
  const services = normalizeList(user?.services);
  const pages = normalizeList(user?.pages);
  const syncStatus = entitlementsLoading || syncing || loading ? 'Syncing' : entitlementsError ? 'Partial sync' : user ? 'Synced' : 'Signed out';

  if (!ready) {
    return <AccountSkeleton title={meta.title} />;
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-65px)] max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">{meta.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{meta.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{meta.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone={syncStatus === 'Synced' ? 'success' : syncStatus === 'Partial sync' ? 'warning' : 'neutral'}>{syncStatus}</StatusBadge>
            {user ? (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing || loading || entitlementsLoading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing || entitlementsLoading ? 'Refreshing' : 'Refresh from User System'}
              </button>
            ) : null}
            <a
              href={user ? userPortalUrl : registerUrl}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              {user ? 'Open in User System' : 'Create account'}
            </a>
          </div>
        </div>
      </section>

      <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Account navigation">
        {accountTabs.map((item) => (
          <Link
            key={item.page}
            href={item.href}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              item.page === page ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {!user ? (
        <SignedOutState meta={meta} loginHref={loginHref} registerUrl={registerUrl} />
      ) : (
        <>
          <AccountSummary
            entitlementsError={entitlementsError}
            lastSyncedAt={lastSyncedAt}
            membershipTier={membershipTier}
            permissions={permissions}
            services={services}
            signOut={signOut}
            user={user}
            userPortalUrl={userPortalUrl}
          />
          {page === 'profile' ? (
            <ProfileContent
              membershipTier={membershipTier}
              pages={pages}
              permissions={permissions}
              profileUrl={profileUrl}
              services={services}
              user={user}
            />
          ) : null}
          {page === 'molecules' ? (
            <MoleculesContent
              entitlements={entitlements}
              localQuantumHistory={localQuantumHistory}
              moleculesUrl={moleculesUrl}
              permissions={permissions}
            />
          ) : null}
          {page === 'settings' ? (
            <SettingsContent
              permissions={permissions}
              profileUrl={profileUrl}
              securityUrl={securityUrl}
              services={services}
              settingsUrl={settingsUrl}
              userOrigin={userOrigin}
            />
          ) : null}
        </>
      )}
    </main>
  );
}

function AccountSummary({
  entitlementsError,
  lastSyncedAt,
  membershipTier,
  permissions,
  services,
  signOut,
  user,
  userPortalUrl
}: {
  entitlementsError: string | null;
  lastSyncedAt: Date | null;
  membershipTier: string;
  permissions: string[];
  services: string[];
  signOut: () => Promise<void>;
  user: AuthUser;
  userPortalUrl: string;
}) {
  return (
    <section className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <Panel title="User System Identity" subtitle="This panel reflects the current ChemVault User session.">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-slate-950 text-xl font-bold uppercase text-white shadow-sm">
            {initials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold text-slate-950">{user.name || user.email}</h2>
            <p className="mt-1 truncate text-sm text-slate-600">{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge tone="neutral">{membershipTier}</StatusBadge>
              <StatusBadge tone={entitlementsError ? 'warning' : 'success'}>{entitlementsError ? 'Profile synced, permissions pending' : 'Profile and permissions synced'}</StatusBadge>
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Services" value={services.length ? String(services.length) : '1'} />
          <Metric label="Permissions" value={permissions.length ? String(permissions.length) : 'N/A'} />
          <Metric label="Last sync" value={lastSyncedAt ? formatDateTime(lastSyncedAt) : 'Not synced'} />
        </div>
      </Panel>

      <Panel title="Account Actions" subtitle="Account changes are managed in ChemVault User.">
        <div className="grid gap-3">
          <a href={userPortalUrl} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700">
            Open current page in ChemVault User
          </a>
          <Link href="/molecule" className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800">
            Open Molecule Studio
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
          >
            Sign out
          </button>
        </div>
      </Panel>
    </section>
  );
}

function ProfileContent({
  membershipTier,
  pages,
  permissions,
  profileUrl,
  services,
  user
}: {
  membershipTier: string;
  pages: string[];
  permissions: string[];
  profileUrl: string;
  services: string[];
  user: AuthUser;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel title="Profile Details" subtitle="Identity fields returned by ChemVault User.">
        <InfoRow label="Display name" value={user.name || 'Not set'} />
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="User ID" value={user.id} mono />
        <InfoRow label="Role" value={user.role || user.systemRole || 'User'} />
        <InfoRow label="Membership" value={membershipTier} />
        <InfoRow label="Provider" value={user.provider || 'ChemVault User'} />
        <InfoRow label="Last login" value={formatOptionalDate(user.lastLoginAt)} />
        <a href={profileUrl} className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
          Edit profile in User System
        </a>
      </Panel>

      <Panel title="Access Scope" subtitle="Services, pages and permissions synchronized for this account.">
        <TagList title="Services" values={services} empty="Molecule Studio" />
        <TagList title="Pages" values={pages} empty="No page list returned" />
        <TagList title="Molecule permissions" values={permissions} empty="No explicit molecule permissions returned" />
      </Panel>
    </section>
  );
}

function MoleculesContent({
  entitlements,
  localQuantumHistory,
  moleculesUrl,
  permissions
}: {
  entitlements: MoleculeEntitlements | null;
  localQuantumHistory: QuantumHistoryEntry[];
  moleculesUrl: string;
  permissions: string[];
}) {
  const quota = entitlements?.quota;
  const cloudSyncEnabled = Boolean(entitlements?.featureFlags?.cloudLibrarySyncEnabled);
  const savedProjectsEnabled = permissions.includes('molecule.saved_projects');
  const uploadEnabled = permissions.includes('molecule.upload');

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Library Sync" subtitle="Molecule library availability follows ChemVault User entitlements.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Cloud library" value={cloudSyncEnabled ? 'Enabled' : savedProjectsEnabled ? 'Account controlled' : 'Local workspace'} />
            <Metric label="Saved projects" value={formatQuota(quota?.savedProjectsRemaining)} />
            <Metric label="Searches" value={formatQuota(quota?.searchesRemaining)} />
            <Metric label="Exports" value={formatQuota(quota?.exportsRemaining)} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Molecule Studio uses the synced account to decide which library features are available. Local browser work remains available even when cloud
            library access is not enabled.
          </p>
          <a href={moleculesUrl} className="mt-5 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700">
            Open molecule library in User System
          </a>
        </Panel>

        <Panel title="Workspace Actions" subtitle="Continue molecule work from the web app.">
          <div className="grid gap-3 md:grid-cols-2">
            <ActionLink href="/molecule" title="Search molecules" description="Search by compound name or PubChem CID, then inspect 3D structure and properties." />
            <ActionLink href="/molecule" title="Draw structure" description="Use the 2D sketcher and generate molecule data from a drawn structure." />
            <ActionLink href="/molecule" title={uploadEnabled ? 'Upload structures' : 'Upload structures locked'} description={uploadEnabled ? 'Import MOL, SDF, XYZ, PDB or SMILES files.' : 'Upload access depends on molecule.upload permission.'} />
            <ActionLink href="/molecule" title="Export current work" description="Export supported formats and images from the active molecule workspace." />
          </div>
        </Panel>
      </div>

      <Panel title="Local Quantum Calculation Records" subtitle="Saved automatically after desktop quantum calculations on this computer.">
        {localQuantumHistory.length ? (
          <div className="grid gap-3">
            {localQuantumHistory.slice(0, 8).map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-950">{entry.moleculeName}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {entry.engineLabel} / {entry.mode} / {formatDateTime(new Date(entry.createdAt))}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{entry.diagnosisTitle}</p>
                  </div>
                  <StatusBadge tone={entry.status === 'completed' ? 'success' : entry.status === 'failed' ? 'warning' : 'neutral'}>
                    {entry.status}
                  </StatusBadge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <Metric label="Atoms" value={String(entry.atomCount)} />
                  <Metric label="Energy" value={entry.energyHartree === null ? 'N/A' : `${entry.energyHartree.toFixed(4)} Eh`} />
                  <Metric label="Dipole" value={entry.dipoleDebye === null ? 'N/A' : `${entry.dipoleDebye.toFixed(4)} D`} />
                  <Metric label="Charge / spin" value={`${entry.charge} / ${entry.unpairedElectrons}`} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            No local quantum calculation records yet. Run a desktop calculation in Molecule Studio to save a local record here.
          </p>
        )}
      </Panel>
    </section>
  );
}

function SettingsContent({
  permissions,
  profileUrl,
  securityUrl,
  services,
  settingsUrl,
  userOrigin
}: {
  permissions: string[];
  profileUrl: string;
  securityUrl: string;
  services: string[];
  settingsUrl: string;
  userOrigin: string;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel title="Managed in ChemVault User" subtitle="Security and account preferences remain centralized in the user system.">
        <div className="grid gap-3">
          <ExternalAction href={profileUrl} title="Profile information" description="Name, email identity and account profile fields." />
          <ExternalAction href={securityUrl} title="Security and sign-in" description="Password, linked providers and account security controls." />
          <ExternalAction href={settingsUrl} title="Account preferences" description="User-system level preferences for ChemVault apps." />
        </div>
      </Panel>

      <Panel title="Molecule Studio Settings" subtitle="Current web app configuration and synced access controls.">
        <InfoRow label="User system" value={normalizeOrigin(userOrigin)} mono />
        <InfoRow label="App source" value="model" />
        <InfoRow label="Primary service" value={services[0] || 'Molecule Studio'} />
        <TagList title="Enabled permissions" values={permissions} empty="No explicit molecule permissions returned" />
      </Panel>
    </section>
  );
}

function SignedOutState({ loginHref, meta, registerUrl }: { loginHref: Route; meta: AccountPageMeta; registerUrl: string }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
      <Panel title={`${meta.title} requires sign in`} subtitle="ChemVault User is the source of truth for account data.">
        <p className="text-sm leading-6 text-slate-600">
          Sign in to synchronize your profile, Molecule Studio permissions, services and account-managed settings with the user system.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={loginHref} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Sign in
          </Link>
          <a href={registerUrl} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700">
            Create account
          </a>
          <Link href="/molecule" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Open Molecule Studio
          </Link>
        </div>
      </Panel>
      <Panel title="What sync includes" subtitle="Available after sign in.">
        <div className="grid gap-3 text-sm text-slate-600">
          <p>Profile identity and account role.</p>
          <p>Molecule Studio service and page access.</p>
          <p>Feature permissions, quota and library availability.</p>
        </div>
      </Panel>
    </section>
  );
}

function AccountSkeleton({ title }: { title: string }) {
  return (
    <main className="mx-auto min-h-[calc(100vh-65px)] max-w-7xl px-4 py-8 sm:px-6 lg:px-8" aria-label={`Loading ${title}`}>
      <div className="mb-6 h-32 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <LoadingState
          compact
          label={`Loading ${title}`}
          description="Syncing account state from ChemVault User."
        />
      </div>
    </main>
  );
}

function Panel({ children, subtitle, title }: { children: React.ReactNode; subtitle?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-lg font-bold text-slate-950" title={value}>
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className={`max-w-full break-words text-sm font-semibold text-slate-900 sm:text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function TagList({ empty, title, values }: { empty: string; title: string; values: string[] }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {values.length ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function ActionLink({ description, href, title }: { description: string; href: Route; title: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-300 hover:bg-white">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  );
}

function ExternalAction({ description, href, title }: { description: string; href: string; title: string }) {
  return (
    <a href={href} className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-300 hover:bg-white">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </a>
  );
}

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: 'success' | 'warning' | 'neutral' }) {
  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-600';

  return <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${className}`}>{children}</span>;
}

function initials(user: AuthUser) {
  const source = user.name || user.email || 'ChemVault User';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
  return source.slice(0, 2);
}

function normalizeList(value?: string[]) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizePermissions(value?: string[] | null) {
  return Array.isArray(value) ? value.filter(Boolean).sort((a, b) => a.localeCompare(b)) : [];
}

function normalizeOrigin(origin: string) {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

function formatQuota(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : 'N/A';
}

function formatDateTime(value: Date) {
  return value.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatOptionalDate(value?: string | null) {
  if (!value) return 'Not returned';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDateTime(date);
}
