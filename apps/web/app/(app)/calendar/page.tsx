'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { useScope } from '@/context/scope-context';
import { useApiQuery } from '@/hooks/use-api-query';
import { api } from '@/lib/api';
import { currentWeekRange } from '@/lib/week-range';
import { CreateCalendarEventSchema, CreateTimeBlockSchema } from '@lifeos/contracts';
import { FormEvent, useMemo, useState } from 'react';

export default function CalendarPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const range = useMemo(() => currentWeekRange(), []);
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loader = useMemo(() => {
    if (!scope) return null;
    return async () => {
      const [events, blocks] = await Promise.all([
        api.listCalendarEvents(scope.type, scope.id, range.from, range.to),
        api.listTimeBlocks(range.from, range.to),
      ]);
      return { events: events.items, blocks: blocks.items };
    };
  }, [scope, range.from, range.to]);

  const { data, loading, error, reload } = useApiQuery(
    loader ?? (async () => ({ events: [], blocks: [] })),
    [scope?.type, scope?.id, range.from, range.to],
  );

  async function onCreateEvent(e: FormEvent) {
    e.preventDefault();
    if (!scope) return;
    setPending(true);
    setFormError(null);
    try {
      const start = new Date();
      start.setMinutes(0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      const payload = CreateCalendarEventSchema.parse({
        scopeType: scope.type,
        scopeId: scope.id,
        title,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      await api.createCalendarEvent(payload);
      setTitle('');
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setPending(false);
    }
  }

  async function onCreateBlock() {
    if (!scope) return;
    setPending(true);
    setFormError(null);
    try {
      const start = new Date();
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 25);
      const payload = CreateTimeBlockSchema.parse({
        scopeType: scope.type,
        scopeId: scope.id,
        title: 'Focus block',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      await api.createTimeBlock(payload);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create time block');
    } finally {
      setPending(false);
    }
  }

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!scope) return <EmptyBlock title="No workspace" />;

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={`Events and time blocks for this week (${range.weekStart}).`}
      />
      <form onSubmit={onCreateEvent} className="lifeos-panel mb-4 flex flex-wrap gap-3 p-4">
        <input
          className="lifeos-input min-w-[12rem] flex-1"
          placeholder="New event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button type="submit" className="lifeos-btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Add event'}
        </button>
        <button type="button" className="lifeos-btn-ghost" disabled={pending} onClick={() => void onCreateBlock()}>
          Add 25m block
        </button>
        {formError ? (
          <p className="w-full text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
      {loading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => void reload()} /> : null}
      {!loading && !error ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="lifeos-panel p-4">
            <h2 className="mb-3 font-display text-lg">Events</h2>
            {data?.events?.length ? (
              <ul className="space-y-2 text-sm">
                {data.events.map((row) => {
                  const ev = row as Record<string, unknown>;
                  return (
                    <li key={String(ev.id)} className="rounded-md border border-slate-200/80 px-3 py-2">
                      <span className="font-medium">{String(ev.title ?? 'Event')}</span>
                      <span className="mt-1 block text-xs text-slate-600">
                        {String(ev.starts_at ?? ev.startsAt)} → {String(ev.ends_at ?? ev.endsAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyBlock title="No events this week" description="Add an event above." />
            )}
          </section>
          <section className="lifeos-panel p-4">
            <h2 className="mb-3 font-display text-lg">Time blocks</h2>
            {data?.blocks?.length ? (
              <ul className="space-y-2 text-sm">
                {data.blocks.map((row) => {
                  const block = row as Record<string, unknown>;
                  return (
                    <li key={String(block.id)} className="rounded-md border border-slate-200/80 px-3 py-2">
                      <span className="font-medium">{String(block.title ?? 'Block')}</span>
                      <span className="mt-1 block text-xs text-slate-600">
                        {String(block.starts_at ?? block.startsAt)} → {String(block.ends_at ?? block.endsAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyBlock title="No time blocks" description="Use “Add 25m block” to schedule focus time." />
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
