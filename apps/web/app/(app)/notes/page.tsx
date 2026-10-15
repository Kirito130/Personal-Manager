'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

export default function NotesPage() {
  const { data, loading, error, reload } = useApiQuery(() => api.listNotes(), []);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      await api.createNote({ title, body });
      setTitle('');
      setBody('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader title="Notes" subtitle="Quick capture in your personal workspace." />
      <form onSubmit={onSubmit} className="lifeos-panel mb-6 space-y-3 p-4">
        <input
          className="lifeos-input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="lifeos-input min-h-[6rem]"
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" className="lifeos-btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Create note'}
        </button>
        {formError ? (
          <p className="text-sm text-red-800" role="alert">
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
                const note = row as Record<string, unknown>;
                return (
                  <li key={String(note.id)} className="py-3">
                    <h3 className="font-medium text-ink">{String(note.title ?? 'Note')}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {String(note.body ?? '')}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyBlock title="No notes yet" description="Create your first note above." />
          )}
        </section>
      ) : null}
    </>
  );
}
