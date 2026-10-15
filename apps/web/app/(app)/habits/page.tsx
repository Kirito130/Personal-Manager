'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { CreateHabitSchema } from '@lifeos/contracts';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

export default function HabitsPage() {
  const { data, loading, error, reload } = useApiQuery(() => api.listHabits(), []);
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      const payload = CreateHabitSchema.parse({ title });
      await api.createHabit(payload);
      setTitle('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create habit');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Habits" subtitle="Daily rhythms tied to your personal space." />
      <form onSubmit={onSubmit} className="lifeos-panel mb-6 space-y-3 p-6">
        <label htmlFor="habit-title" className="block text-sm font-medium text-slate-700">
          New habit
        </label>
        <input
          id="habit-title"
          className="lifeos-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button type="submit" className="lifeos-btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Create habit'}
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
        <EmptyBlock title="No habits yet" description="The habits API will populate this list." />
      ) : null}
    </div>
  );
}
