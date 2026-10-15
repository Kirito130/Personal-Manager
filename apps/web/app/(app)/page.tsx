'use client';

import { CreateTaskForm } from '@/components/tasks/create-task-form';
import { TaskList } from '@/components/tasks/task-list';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { useMemo } from 'react';

export default function TodayPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();

  const loader = useMemo(() => {
    if (!scope) return null;
    return () => api.listTasks(scope.type, scope.id);
  }, [scope]);

  const { data, loading, error, reload } = useApiQuery(
    loader ?? (async () => ({ items: [], nextCursor: null })),
    [scope?.type, scope?.id],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dueToday =
    data?.items.filter((t) => {
      if (!t.due_at || t.status_category === 'DONE' || t.status_category === 'CANCELLED') {
        return false;
      }
      const d = new Date(t.due_at);
      return d >= today && d < tomorrow;
    }) ?? [];

  const inbox =
    data?.items.filter(
      (t) =>
        t.status_category !== 'DONE' &&
        t.status_category !== 'CANCELLED' &&
        (!t.due_at || new Date(t.due_at) >= tomorrow),
    ) ?? [];

  if (scopeLoading) return <LoadingBlock label="Loading workspace…" />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!scope) return <EmptyBlock title="No workspace" description="Sign in again to continue." />;

  return (
    <>
      <PageHeader
        title="Command Center"
        subtitle={`Today in ${scope.label} — focus on what matters now.`}
      />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="lifeos-panel p-4 lg:col-span-2">
          <CreateTaskForm onCreated={() => void reload()} />
        </div>
        <div className="lifeos-panel p-4 text-sm">
          <p className="font-medium text-ink">{today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <p className="mt-2 text-slate-600">
            {dueToday.length} due today · {inbox.length} in backlog
          </p>
        </div>
      </div>

      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}

      {!loading && !error ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="lifeos-panel p-4">
            <h2 className="font-display text-lg text-ink">Due today</h2>
            {dueToday.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Nothing due today. Pick one from the backlog.</p>
            ) : (
              <div className="mt-3">
                <TaskList tasks={dueToday} />
              </div>
            )}
          </section>
          <section className="lifeos-panel p-4">
            <h2 className="font-display text-lg text-ink">Backlog</h2>
            {inbox.length === 0 ? (
              <EmptyBlock title="All clear" description="Add a task above to get started." />
            ) : (
              <div className="mt-3">
                <TaskList tasks={inbox.slice(0, 12)} />
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
