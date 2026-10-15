'use client';

import { ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { todayLocalDate } from '@/lib/week-range';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useEffect, useState } from 'react';

export default function JournalPage() {
  const [localDate, setLocalDate] = useState(todayLocalDate);
  const { data, loading, error, reload } = useApiQuery(
    () => api.getJournalEntry(localDate),
    [localDate],
  );
  const [body, setBody] = useState('');
  const [mood, setMood] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!data) {
      setBody('');
      setMood('');
      return;
    }
    const entry = data as Record<string, unknown>;
    setBody(String(entry.body ?? ''));
    setMood(String(entry.mood ?? ''));
  }, [data, localDate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      await api.upsertJournalEntry({
        localDate,
        body,
        mood: mood || undefined,
      });
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Journal" subtitle="Personal reflections — stored by local date." />
      <form onSubmit={onSubmit} className="lifeos-panel space-y-4 p-6">
        <div>
          <label htmlFor="journal-date" className="mb-1 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="journal-date"
            type="date"
            className="lifeos-input"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="journal-mood" className="mb-1 block text-sm font-medium text-slate-700">
            Mood (optional)
          </label>
          <input
            id="journal-mood"
            className="lifeos-input"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder="Calm, focused, tired…"
          />
        </div>
        <div>
          <label htmlFor="journal-body" className="mb-1 block text-sm font-medium text-slate-700">
            Entry
          </label>
          <textarea
            id="journal-body"
            className="lifeos-input min-h-[12rem]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened today?"
          />
        </div>
        <button type="submit" className="lifeos-btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save entry'}
        </button>
        {formError ? (
          <p className="text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
    </div>
  );
}
