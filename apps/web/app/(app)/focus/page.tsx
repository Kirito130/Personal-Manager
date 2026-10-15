'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { useState } from 'react';

export default function FocusPage() {
  const { data, loading, error, reload } = useApiQuery(() => api.getActiveFocusSession(), []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const session = data && typeof data === 'object' && 'id' in data ? (data as Record<string, unknown>) : null;
  const status = session ? String(session.status ?? '') : null;

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader title="Focus" subtitle="Deep work sessions tied to your active task (optional)." />
      <div className="lifeos-panel mb-6 flex flex-wrap gap-3 p-4">
        {!session ? (
          <button
            type="button"
            className="lifeos-btn-primary"
            disabled={pending}
            onClick={() => void run(() => api.startFocusSession())}
          >
            Start focus session
          </button>
        ) : (
          <>
            <span className="self-center text-sm text-slate-700">
              Active session · <span className="font-medium capitalize">{status}</span>
            </span>
            {status === 'running' ? (
              <button
                type="button"
                className="lifeos-btn-ghost"
                disabled={pending}
                onClick={() => void run(() => api.pauseFocusSession(String(session.id)))}
              >
                Pause
              </button>
            ) : null}
            {status === 'paused' ? (
              <button
                type="button"
                className="lifeos-btn-ghost"
                disabled={pending}
                onClick={() => void run(() => api.resumeFocusSession(String(session.id)))}
              >
                Resume
              </button>
            ) : null}
            <button
              type="button"
              className="lifeos-btn-primary"
              disabled={pending}
              onClick={() => void run(() => api.finishFocusSession(String(session.id)))}
            >
              Finish
            </button>
          </>
        )}
        {actionError ? (
          <p className="w-full text-sm text-red-800" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error && !session ? (
        <EmptyBlock title="No active session" description="Start a focus session when you are ready to work." />
      ) : null}
      {session ? (
        <section className="lifeos-panel p-4">
          <pre className="overflow-x-auto text-xs text-slate-700">{JSON.stringify(session, null, 2)}</pre>
        </section>
      ) : null}
    </>
  );
}
