'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { apiFetch } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = String(params.id);
  const { data, loading, error, reload } = useApiQuery(
    () => apiFetch<Record<string, unknown>>(`/projects/${projectId}`),
    [projectId],
  );

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} onRetry={() => void reload()} />;
  if (!data) return <EmptyBlock title="Project not found" />;

  return (
    <>
      <PageHeader
        title={String(data.name ?? 'Project')}
        subtitle={String(data.description ?? 'Project detail from API')}
        actions={
          <Link href="/projects" className="lifeos-btn-ghost">
            ← Projects
          </Link>
        }
      />
      <pre className="lifeos-panel overflow-x-auto p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </>
  );
}
