'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

export default function AutomationsPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();

  const { data, loading, error, reload } = useApiQuery(
    () => (scope ? api.listAutomations(scope.type, scope.id) : Promise.resolve({ items: [] })),
    [scope?.type, scope?.id],
  );

  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('task.completed');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!scope) return;
    setPending(true);
    setFormError(null);
    try {
      await api.createAutomation({
        scopeType: scope.type,
        scopeId: scope.id,
        name,
        triggerEvent,
        action: { type: 'notify', channel: 'in_app' },
      });
      setName('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create automation');
    } finally {
      setPending(false);
    }
  }

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!scope) return <EmptyBlock title="No workspace" />;

  return (
    <>
      <PageHeader title="Automations" subtitle="Trigger → action rules for the active scope." />
      <form onSubmit={onSubmit} className="lifeos-panel mb-6 grid gap-3 p-4 md:grid-cols-2">
        <input
          className="lifeos-input"
          placeholder="Automation name"
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
        <button type="submit" className="lifeos-btn-primary md:col-span-2" disabled={pending}>
          {pending ? 'Saving…' : 'Create automation'}
        </button>
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
          {data?.items?.length ? (
            <ul className="divide-y divide-slate-200/80">
              {data.items.map((row) => {
                const auto = row as Record<string, unknown>;
                return (
                  <li key={String(auto.id)} className="py-3">
                    <p className="font-medium">{String(auto.name)}</p>
                    <p className="text-xs text-slate-600">
                      {String(auto.trigger_event ?? auto.triggerEvent)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyBlock title="No automations" description="Create a rule above." />
          )}
        </section>
      ) : null}
    </>
  );
}
