'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

export default function ReportsPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const [reportId, setReportId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState('tasks.summary');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data, loading, error, reload } = useApiQuery(
    () => (reportId ? api.getReport(reportId) : Promise.resolve(null)),
    [reportId],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!scope) return;
    setPending(true);
    setFormError(null);
    try {
      const created = await api.createReport({
        scopeType: scope.type,
        scopeId: scope.id,
        name,
        reportType,
        definition: {},
      });
      setReportId(String(created.id));
      setName('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setPending(false);
    }
  }

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!scope) return <EmptyBlock title="No workspace" />;

  return (
    <>
      <PageHeader title="Reports" subtitle="Define a report, then fetch it by ID." />
      <form onSubmit={onSubmit} className="lifeos-panel mb-6 grid gap-3 p-4 md:grid-cols-2">
        <input
          className="lifeos-input"
          placeholder="Report name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="lifeos-input"
          placeholder="Report type"
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
        />
        <button type="submit" className="lifeos-btn-primary md:col-span-2" disabled={pending}>
          {pending ? 'Creating…' : 'Create & load report'}
        </button>
        {formError ? (
          <p className="md:col-span-2 text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
      {reportId && loading ? <LoadingBlock /> : null}
      {reportId && error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {reportId && data && !loading && !error ? (
        <section className="lifeos-panel p-4">
          <p className="mb-2 text-xs text-slate-500">
            Report ID: <span className="font-mono">{reportId}</span>
          </p>
          <pre className="overflow-x-auto text-xs text-slate-700">{JSON.stringify(data, null, 2)}</pre>
        </section>
      ) : null}
      {!reportId ? (
        <EmptyBlock title="No report selected" description="Create a report definition to load results." />
      ) : null}
    </>
  );
}
