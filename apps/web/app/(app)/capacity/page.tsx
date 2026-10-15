'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { OrgRequiredEmpty } from '@/components/ui/org-required-empty';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { currentWeekRange } from '@/lib/week-range';
import { useApiQuery } from '@/hooks/use-api-query';
import { useMemo } from 'react';

export default function CapacityPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const orgId = scope?.type === 'ORGANIZATION' ? scope.id : null;
  const { weekStart } = useMemo(() => currentWeekRange(), []);

  const { data, loading, error, reload } = useApiQuery(
    () => (orgId ? api.getCapacity(orgId, weekStart) : Promise.resolve(null)),
    [orgId, weekStart],
  );

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!orgId) return <OrgRequiredEmpty />;

  return (
    <>
      <PageHeader title="Capacity" subtitle={`Team load for week starting ${weekStart}.`} />
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error && data ? (
        <section className="lifeos-panel overflow-x-auto p-4">
          {'resources' in data && Array.isArray((data as { resources: unknown[] }).resources) ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Resource</th>
                  <th className="py-2 pr-4">Allocated</th>
                  <th className="py-2 pr-4">Leave</th>
                  <th className="py-2">Available</th>
                </tr>
              </thead>
              <tbody>
                {(data as { resources: Array<Record<string, unknown>> }).resources.map((r) => (
                  <tr key={String(r.id)} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{String(r.display_name ?? r.displayName ?? r.id)}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{String(r.allocated_hours ?? '—')}</td>
                    <td className="py-2 pr-4 font-mono tabular-nums">{String(r.leave_hours ?? '—')}</td>
                    <td className="py-2 font-mono tabular-nums">{String(r.available_hours ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="text-xs text-slate-700">{JSON.stringify(data, null, 2)}</pre>
          )}
        </section>
      ) : null}
      {!loading && !error && !data ? (
        <EmptyBlock title="No capacity data" description="Capacity appears once resources are configured." />
      ) : null}
    </>
  );
}
