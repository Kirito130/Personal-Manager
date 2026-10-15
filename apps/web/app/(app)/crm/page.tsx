'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { OrgRequiredEmpty } from '@/components/ui/org-required-empty';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function CrmPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const orgId = scope?.type === 'ORGANIZATION' ? scope.id : null;

  const { data, loading, error, reload } = useApiQuery(
    () => (orgId ? api.listCrmAccounts(orgId) : Promise.resolve({ items: [] })),
    [orgId],
  );

  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setPending(true);
    setFormError(null);
    try {
      await api.createCrmAccount({ organizationId: orgId, name });
      setName('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setPending(false);
    }
  }

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!orgId) return <OrgRequiredEmpty />;

  return (
    <>
      <PageHeader
        title="CRM"
        subtitle="Accounts for the active organization."
        actions={
          <Link href="/crm/opportunities" className="lifeos-btn-ghost">
            Opportunities →
          </Link>
        }
      />
      <form onSubmit={onSubmit} className="lifeos-panel mb-6 flex flex-wrap gap-3 p-4">
        <input
          className="lifeos-input min-w-[12rem] flex-1"
          placeholder="Account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" className="lifeos-btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Add account'}
        </button>
        {formError ? (
          <p className="w-full text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error ? (
        <section className="lifeos-panel overflow-x-auto p-4">
          {data?.items?.length ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Name</th>
                  <th className="py-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const account = row as Record<string, unknown>;
                  return (
                    <tr key={String(account.id)} className="border-b border-slate-100">
                      <td className="py-2 font-medium">{String(account.name)}</td>
                      <td className="py-2 font-mono text-xs text-slate-600">{String(account.id)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyBlock title="No accounts" description="Add your first CRM account above." />
          )}
        </section>
      ) : null}
    </>
  );
}
