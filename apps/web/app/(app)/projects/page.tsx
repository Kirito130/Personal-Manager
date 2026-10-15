'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { CreateProjectSchema } from '@lifeos/contracts';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

export default function ProjectsPage() {
  const { scope } = useScope();
  const { data, loading, error, reload } = useApiQuery(
    () =>
      scope
        ? api.listProjects(scope.type, scope.id)
        : Promise.resolve({ items: [] }),
    [scope?.type, scope?.id],
  );
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!scope) return;
    setPending(true);
    setFormError(null);
    try {
      const payload = CreateProjectSchema.parse({
        scopeType: scope.type,
        scopeId: scope.id,
        name,
      });
      const created = await api.createProject(payload);
      if (typeof window !== 'undefined' && created.boardId) {
        sessionStorage.setItem(`lifeos-board:${created.id}`, String(created.boardId));
      }
      setName('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader title="Projects" subtitle="Phase 3 delivery — scoped projects with client links." />
      {scope ? (
        <form onSubmit={onSubmit} className="lifeos-panel mb-6 flex flex-wrap gap-3 p-4">
          <input
            className="lifeos-input min-w-[12rem] flex-1"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" className="lifeos-btn-primary" disabled={pending}>
            {pending ? 'Creating…' : 'Create project'}
          </button>
          {formError ? (
            <p className="w-full text-sm text-red-800" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      ) : null}
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error && !data?.items?.length ? (
        <EmptyBlock title="No projects" description="Projects API will populate this view." />
      ) : null}
    </>
  );
}
