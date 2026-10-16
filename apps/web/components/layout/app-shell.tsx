'use client';

import { ScopeProvider } from '@/context/scope-context';
import { createBrowserAuthClient } from '@/lib/supabase/browser-auth';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ScopeSwitcher } from './scope-switcher';
import { SideNav } from './side-nav';

function ShellInner({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  async function signOut() {
    const { auth } = createBrowserAuthClient();
    await auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={clsx(
          'flex shrink-0 flex-col border-r border-slate-200/80 bg-white/40 backdrop-blur-md transition-[width]',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200/60 px-3 py-4">
          {!collapsed ? (
            <Link href="/" className="font-display text-lg font-semibold text-ink">
              LifeOS
            </Link>
          ) : (
            <Link href="/" className="font-display text-lg font-semibold text-ink" title="LifeOS">
              L
            </Link>
          )}
        </div>
        <SideNav collapsed={collapsed} />
        <button
          type="button"
          className="m-2 lifeos-btn-ghost text-xs"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          {collapsed ? '→' : '← Collapse'}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white/50 px-4 py-3 backdrop-blur-md">
          <ScopeSwitcher />
          <div className="flex min-w-[12rem] flex-1 items-center gap-2">
            <label className="sr-only" htmlFor="global-search">
              Search
            </label>
            <input
              id="global-search"
              type="search"
              placeholder="Search (coming soon)"
              className="lifeos-input max-w-md flex-1 opacity-80"
              disabled
            />
          </div>
          <button type="button" className="lifeos-btn-ghost text-sm" disabled title="Quick capture">
            + Capture
          </button>
          <button type="button" className="lifeos-btn-ghost text-sm" onClick={() => void signOut()}>
            Sign out
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ScopeProvider>
      <ShellInner>{children}</ShellInner>
    </ScopeProvider>
  );
}
