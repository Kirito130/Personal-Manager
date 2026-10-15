'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { CreateGoalSchema } from '@lifeos/contracts';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

export default function GoalsPage() {
  const { data, loading, error, reload } = useApiQuery(() => api.listGoals(), []);
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      const payload = CreateGoalSchema.parse({ title });
      await api.createGoal(payload);
      setTitle('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Goals"
        subtitle="Longer horizons with room to breathe — track outcomes, not busywork."
      />
      <form onSubmit={onSubmit} className="lifeos-panel mb-6 space-y-3 p-6">
        <label htmlFor="goal-title" className="block text-sm font-medium text-slate-700">
          New goal
        </label>
        <input
          id="goal-title"
          className="lifeos-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you working toward?"
          required
        />
        <button type="submit" className="lifeos-btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Create goal'}
        </button>
        {formError ? (
          <p className="text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error && data?.items?.length === 0 ? (
        <EmptyBlock title="No goals yet" description="Create one above when the goals API is available." />
      ) : null}
    </div>
  );
}
