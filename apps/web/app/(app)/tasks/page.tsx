'use client';

import { CreateTaskForm } from '@/components/tasks/create-task-form';
import { TaskList } from '@/components/tasks/task-list';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { useMemo } from 'react';

export default function TasksPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const loader = useMemo(() => {
    if (!scope) return null;
    return () => api.listTasks(scope.type, scope.id);
  }, [scope]);

  const { data, loading, error, reload } = useApiQuery(
    loader ?? (async () => ({ items: [], nextCursor: null })),
    [scope?.type, scope?.id],
  );

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!scope) return <EmptyBlock title="No workspace" />;

  return (
    <>
      <PageHeader title="Tasks" subtitle="Native LifeOS tasks for the active scope." />
      <div className="mb-6">
        <CreateTaskForm onCreated={() => void reload()} />
      </div>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error ? (
        <section className="lifeos-panel p-4">
          {data?.items.length ? (
            <TaskList tasks={data.items} />
          ) : (
            <EmptyBlock title="No tasks" description="Create your first task above." />
          )}
        </section>
      ) : null}
    </>
  );
}
