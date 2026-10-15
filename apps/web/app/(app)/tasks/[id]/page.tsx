'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = String(params.id);
  const { data, loading, error, reload } = useApiQuery(() => api.getTask(taskId), [taskId]);
  const [checklistText, setChecklistText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function complete() {
    if (!data) return;
    setPending(true);
    setActionError(null);
    try {
      await api.completeTask(data.id, data.version);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  async function addChecklist(e: FormEvent) {
    e.preventDefault();
    if (!checklistText.trim()) return;
    setPending(true);
    setActionError(null);
    try {
      await api.addChecklistItem(taskId, checklistText.trim());
      setChecklistText('');
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} onRetry={() => void reload()} />;
  if (!data) return <EmptyBlock title="Task not found" />;

  return (
    <>
      <PageHeader
        title={data.title}
        subtitle={data.description || 'No description'}
        actions={
          <>
            <Link href="/tasks" className="lifeos-btn-ghost">
              ← Tasks
            </Link>
            {data.status_category !== 'DONE' ? (
              <button type="button" className="lifeos-btn-primary" disabled={pending} onClick={() => void complete()}>
                Mark done
              </button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lifeos-panel space-y-3 p-4 lg:col-span-2">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium">{data.status_category}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Priority</dt>
              <dd className="font-medium">P{data.priority}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Due</dt>
              <dd className="font-medium">
                {data.due_at ? new Date(data.due_at).toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Version</dt>
              <dd className="font-medium">{data.version}</dd>
            </div>
          </dl>
        </section>
        <section className="lifeos-panel p-4">
          <h2 className="font-display text-lg">Checklist</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.checklist.map((item) => (
              <li key={item.id} className="flex gap-2">
                <span aria-hidden>{item.is_complete ? '☑' : '☐'}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
          <form className="mt-4 flex gap-2" onSubmit={addChecklist}>
            <input
              className="lifeos-input flex-1"
              placeholder="Add checklist item"
              value={checklistText}
              onChange={(e) => setChecklistText(e.target.value)}
            />
            <button type="submit" className="lifeos-btn-primary" disabled={pending}>
              Add
            </button>
          </form>
        </section>
      </div>
      {actionError ? (
        <p className="mt-4 text-sm text-red-800" role="alert">
          {actionError}
        </p>
      ) : null}
    </>
  );
}
