'use client';

import { ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

export default function SettingsPage() {
  const { me, refresh } = useScope();
  const health = useApiQuery(() => api.health(), []);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createOrg(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const org = await api.createOrganization({ name, slug, currency: 'USD' });
      setMessage(`Created organization “${org.name}”. Switch scope in the top bar.`);
      setName('');
      setSlug('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Profile, organizations, and system status." />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <section className="lifeos-panel p-4">
          <h2 className="font-display text-lg">Profile</h2>
          {me ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd>{me.user.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Display name</dt>
                <dd>{me.user.display_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Personal space</dt>
                <dd className="font-mono text-xs">{me.personalSpaceId}</dd>
              </div>
            </dl>
          ) : (
            <LoadingBlock label="Loading profile…" />
          )}
        </section>
        <section className="lifeos-panel p-4">
          <h2 className="font-display text-lg">API health</h2>
          {health.loading ? <LoadingBlock /> : null}
          {health.error ? <ErrorBlock error={health.error} onRetry={() => void health.reload()} /> : null}
          {health.data ? (
            <pre className="mt-3 overflow-x-auto rounded bg-slate-900/5 p-3 text-xs">
              {JSON.stringify(health.data, null, 2)}
            </pre>
          ) : null}
        </section>
        <section className="lifeos-panel p-4 lg:col-span-2">
          <h2 className="font-display text-lg">Create organization</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-3 md:items-end" onSubmit={createOrg}>
            <div>
              <label htmlFor="org-name" className="mb-1 block text-xs font-medium text-slate-600">
                Name
              </label>
              <input
                id="org-name"
                className="lifeos-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="org-slug" className="mb-1 block text-xs font-medium text-slate-600">
                Slug
              </label>
              <input
                id="org-slug"
                className="lifeos-input"
                pattern="[a-z0-9-]+"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="lifeos-btn-primary" disabled={pending}>
              {pending ? 'Creating…' : 'Create'}
            </button>
          </form>
          {message ? <p className="mt-3 text-sm text-teal-dark">{message}</p> : null}
          {error ? (
            <p className="mt-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
