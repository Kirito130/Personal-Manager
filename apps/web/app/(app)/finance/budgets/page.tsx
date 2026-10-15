'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';

type Budget = { id: string; name: string; currency: string; status: string };

export default function BudgetsPage() {
  const { data, error, loading, reload } = useApiQuery(() => api.listBudgets(), []);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.createBudget({ name, currency });
      setName('');
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create budget');
    } finally {
      setSaving(false);
    }
  }

  const items = (data?.items ?? []) as Budget[];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Budgets"
        subtitle="Personal monthly and custom-period budget plans."
      />

      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Name</span>
          <input
            className="rounded border border-slate-300 bg-white px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Currency</span>
          <input
            className="w-24 rounded border border-slate-300 bg-white px-3 py-2"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Create budget'}
        </button>
      </form>
      {formError ? <ErrorBlock error={new Error(formError)} /> : null}

      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={reload} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyBlock title="No budgets yet" description="Create a plan to track spending limits." />
      ) : null}
      {!loading && items.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {items.map((b) => (
            <li key={b.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium text-slate-900">{b.name}</span>
              <span className="text-slate-500">
                {b.currency} · {b.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
