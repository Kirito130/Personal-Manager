'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { OrgRequiredEmpty } from '@/components/ui/org-required-empty';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function CrmOpportunitiesPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const orgId = scope?.type === 'ORGANIZATION' ? scope.id : null;

  const { data, loading, error, reload } = useApiQuery(async () => {
    if (!orgId) return { opportunities: [], accounts: [] };
    const [opportunities, accounts] = await Promise.all([
      api.listCrmOpportunities(orgId),
      api.listCrmAccounts(orgId),
    ]);
    return { opportunities: opportunities.items, accounts: accounts.items };
  }, [orgId]);

  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [expectedValue, setExpectedValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !accountId) return;
    setPending(true);
    setFormError(null);
    try {
      await api.createCrmOpportunity({
        organizationId: orgId,
        accountId,
        name,
        expectedValue: expectedValue || undefined,
        currency: 'USD',
      });
      setName('');
      setExpectedValue('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create opportunity');
    } finally {
      setPending(false);
    }
  }

  async function convert(id: string) {
    setPending(true);
    setFormError(null);
    try {
      await api.convertCrmOpportunity(id);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Convert failed');
    } finally {
      setPending(false);
    }
  }

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!orgId) return <OrgRequiredEmpty />;

  const accounts = data?.accounts ?? [];

  return (
    <>
      <PageHeader
        title="Opportunities"
        subtitle="Pipeline deals for the active organization."
        actions={
          <Link href="/crm" className="lifeos-btn-ghost">
            ← Accounts
          </Link>
        }
      />
      <form onSubmit={onSubmit} className="lifeos-panel mb-6 grid gap-3 p-4 md:grid-cols-2">
        <input
          className="lifeos-input md:col-span-2"
          placeholder="Opportunity name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select
          className="lifeos-input"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
        >
          <option value="">Select account</option>
          {accounts.map((row) => {
            const a = row as Record<string, unknown>;
            return (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.name)}
              </option>
            );
          })}
        </select>
        <input
          className="lifeos-input font-mono tabular-nums"
          placeholder="Expected value"
          value={expectedValue}
          onChange={(e) => setExpectedValue(e.target.value)}
        />
        <button type="submit" className="lifeos-btn-primary md:col-span-2" disabled={pending || !accounts.length}>
          {pending ? 'Saving…' : 'Create opportunity'}
        </button>
        {!accounts.length ? (
          <p className="md:col-span-2 text-sm text-slate-600">
            Create a CRM account first on the{' '}
            <Link href="/crm" className="text-teal-800 underline">
              accounts page
            </Link>
            .
          </p>
        ) : null}
        {formError ? (
          <p className="md:col-span-2 text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error ? (
        <section className="lifeos-panel p-4">
          {data?.opportunities?.length ? (
            <ul className="divide-y divide-slate-200/80">
              {data.opportunities.map((row) => {
                const opp = row as Record<string, unknown>;
                return (
                  <li key={String(opp.id)} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-medium">{String(opp.name)}</p>
                      <p className="text-xs text-slate-600">
                        {String(opp.stage ?? opp.status ?? 'open')}
                        {opp.expected_value != null ? ` · ${String(opp.expected_value)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="lifeos-btn-ghost text-sm"
                      disabled={pending}
                      onClick={() => void convert(String(opp.id))}
                    >
                      Convert to project
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyBlock title="No opportunities" description="Create a deal linked to an account." />
          )}
        </section>
      ) : null}
    </>
  );
}
