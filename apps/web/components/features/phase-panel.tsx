'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useApiQuery } from '@/hooks/use-api-query';

export function PhasePanel({
  title,
  subtitle,
  phase,
  load,
  children,
}: {
  title: string;
  subtitle: string;
  phase: string;
  load?: () => Promise<unknown>;
  children?: React.ReactNode;
}) {
  const query = useApiQuery(load ?? (async () => null), [load]);

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">{phase}</p>
      {children}
      {load ? (
        query.loading ? (
          <LoadingBlock />
        ) : query.error ? (
          <ErrorBlock error={query.error} onRetry={() => void query.reload()} />
        ) : query.data === null || (Array.isArray((query.data as { items?: unknown[] })?.items) &&
            (query.data as { items: unknown[] }).items.length === 0) ? (
          <EmptyBlock
            title="No records yet"
            description="The API route may not be implemented yet, or your scope has no data."
          />
        ) : null
      ) : (
        <EmptyBlock
          title="UI ready"
          description="Connect this view to the NestJS module when it ships. Navigation and scope are wired."
        />
      )}
    </>
  );
}
