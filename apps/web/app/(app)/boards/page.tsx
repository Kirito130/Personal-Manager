'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

function boardIdForProject(projectId: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(`lifeos-board:${projectId}`);
}

export default function BoardsPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const { data: projectsData, loading: projectsLoading, error: projectsError, reload: reloadProjects } =
    useApiQuery(
      () => (scope ? api.listProjects(scope.type, scope.id) : Promise.resolve({ items: [] })),
      [scope?.type, scope?.id],
    );

  const projects = (projectsData?.items ?? []) as Record<string, unknown>[];
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const activeProjectId = selectedProjectId || (projects[0] ? String(projects[0].id) : '');
  const boardId = activeProjectId ? boardIdForProject(activeProjectId) : null;

  const boardLoader = useMemo(() => {
    if (!boardId) return null;
    return () => api.getBoard(boardId);
  }, [boardId]);

  const {
    data: boardData,
    loading: boardLoading,
    error: boardError,
    reload: reloadBoard,
  } = useApiQuery(boardLoader ?? (async () => null), [boardId]);

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!scope) return <EmptyBlock title="No workspace" />;

  return (
    <>
      <PageHeader title="Boards" subtitle="Kanban columns for a project board." />
      {projectsLoading ? <LoadingBlock /> : null}
      {projectsError ? <ErrorBlock error={projectsError} onRetry={() => void reloadProjects()} /> : null}
      {!projectsLoading && !projectsError && !projects.length ? (
        <EmptyBlock
          title="No projects"
          description="Create a project first — each new project gets a main board."
          action={
            <Link href="/projects" className="lifeos-btn-primary">
              Go to projects
            </Link>
          }
        />
      ) : null}
      {projects.length ? (
        <div className="lifeos-panel mb-4 flex flex-wrap items-center gap-3 p-4">
          <label htmlFor="board-project" className="text-sm font-medium text-slate-700">
            Project
          </label>
          <select
            id="board-project"
            className="lifeos-input min-w-[12rem]"
            value={activeProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name ?? p.id)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {activeProjectId && !boardId ? (
        <EmptyBlock
          title="Board not loaded"
          description="Open the project detail or create a new project in this session to cache its board ID. Boards are created with each project."
          action={
            <Link href={`/projects/${activeProjectId}`} className="lifeos-btn-primary">
              Open project
            </Link>
          }
        />
      ) : null}
      {boardId && boardLoading ? <LoadingBlock /> : null}
      {boardId && boardError ? <ErrorBlock error={boardError} onRetry={() => void reloadBoard()} /> : null}
      {boardId && boardData && !boardLoading && !boardError ? (
        <section className="lifeos-panel overflow-x-auto p-4">
          <pre className="text-xs text-slate-700">{JSON.stringify(boardData, null, 2)}</pre>
        </section>
      ) : null}
    </>
  );
}
