'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { OrgRequiredEmpty } from '@/components/ui/org-required-empty';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { CorrelationRuleSchema } from '@lifeos/contracts';
import { FormEvent, useState } from 'react';

export default function FinanceCorrelationsPage() {
  const { scope, me } = useScope();
  const orgId = scope?.type === 'ORGANIZATION' ? scope.id : null;

  const { data, loading, error, reload } = useApiQuery(async () => {
    const [rules, links] = await Promise.all([
      api.listCorrelationRules(),
      api.listCorrelationLinks(),
    ]);
    return { rules: rules.items, links: links.items };
  }, []);

  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('invoice.paid');
  const [targetBookId, setTargetBookId] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setPending(true);
    setFormError(null);
    try {
      const payload = CorrelationRuleSchema.parse({
        organizationId: orgId,
        name,
        triggerEvent,
        targetPersonalBookId: targetBookId,
        targetIncomeAccountId: incomeAccountId,
        mode: 'CREATE_DRAFT',
      });
      await api.createCorrelationRule(payload);
      setName('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setPending(false);
    }
  }

  async function confirmLink(linkId: string) {
    setPending(true);
    try {
      await api.confirmCorrelationLink(linkId);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to confirm link');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Finance correlations"
        subtitle="Mirror organization income into personal books (rules and draft links)."
      />
      {!orgId ? (
        <OrgRequiredEmpty />
      ) : (
        <form onSubmit={onSubmit} className="lifeos-panel mb-6 grid gap-3 p-4 md:grid-cols-2">
          <input
            className="lifeos-input md:col-span-2"
            placeholder="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="lifeos-input"
            placeholder="Trigger event"
            value={triggerEvent}
            onChange={(e) => setTriggerEvent(e.target.value)}
          />
          <input
            className="lifeos-input font-mono text-xs"
            placeholder="Target personal book UUID"
            value={targetBookId}
            onChange={(e) => setTargetBookId(e.target.value)}
            required
          />
          <input
            className="lifeos-input font-mono text-xs md:col-span-2"
            placeholder="Target income account UUID"
            value={incomeAccountId}
            onChange={(e) => setIncomeAccountId(e.target.value)}
            required
          />
          <button type="submit" className="lifeos-btn-primary md:col-span-2" disabled={pending}>
            {pending ? 'Saving…' : 'Create rule'}
          </button>
          {me?.personalSpaceId ? (
            <p className="md:col-span-2 text-xs text-slate-500">
              Personal space: <span className="font-mono">{me.personalSpaceId}</span>
            </p>
          ) : null}
          {formError ? (
            <p className="md:col-span-2 text-sm text-red-800" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      )}
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="lifeos-panel p-4">
            <h2 className="mb-3 font-display text-lg">Rules</h2>
            {data?.rules?.length ? (
              <ul className="space-y-2 text-sm">
                {data.rules.map((row) => {
                  const rule = row as Record<string, unknown>;
                  return (
                    <li key={String(rule.id)} className="rounded-md border border-slate-200/80 px-3 py-2">
                      <span className="font-medium">{String(rule.name)}</span>
                      <span className="block text-xs text-slate-600">{String(rule.trigger_event ?? rule.triggerEvent)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyBlock title="No rules" description="Create a correlation rule when org scope is active." />
            )}
          </section>
          <section className="lifeos-panel p-4">
            <h2 className="mb-3 font-display text-lg">Draft links</h2>
            {data?.links?.length ? (
              <ul className="space-y-2 text-sm">
                {data.links.map((row) => {
                  const link = row as Record<string, unknown>;
                  const state = String(link.state ?? link.status ?? '');
                  return (
                    <li key={String(link.id)} className="flex items-center justify-between gap-2 rounded-md border border-slate-200/80 px-3 py-2">
                      <span className="font-mono text-xs">{String(link.id).slice(0, 8)}…</span>
                      <span className="text-xs text-slate-600">{state}</span>
                      {state === 'draft' || state === 'DRAFT' ? (
                        <button
                          type="button"
                          className="lifeos-btn-ghost text-xs"
                          disabled={pending}
                          onClick={() => void confirmLink(String(link.id))}
                        >
                          Confirm
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyBlock title="No links" description="Links appear when correlation events fire." />
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
