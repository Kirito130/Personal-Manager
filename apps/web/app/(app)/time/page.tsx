'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { OrgRequiredEmpty } from '@/components/ui/org-required-empty';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useState } from 'react';

function mondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sundayOfWeek(monday: string): string {
  const d = new Date(monday + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

type Timesheet = {
  id: string;
  period_start: string;
  period_end: string;
  state: string;
};

export default function TimePage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const orgId = scope?.type === 'ORGANIZATION' ? scope.id : null;
  const timesheetsQ = useApiQuery(
    () => (orgId ? api.listTimesheets(orgId) : Promise.resolve({ items: [] })),
    [orgId],
  );

  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('1');
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setPending(true);
    setFormError(null);
    setMessage(null);
    try {
      const endedAt = new Date();
      const startedAt = new Date(endedAt);
      startedAt.setHours(startedAt.getHours() - Number(hours || 1));
      await api.createTimeEntry({
        organizationId: orgId,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        description: description || undefined,
        billable: true,
      });
      setDescription('');
      setMessage('Time entry recorded.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to log time');
    } finally {
      setPending(false);
    }
  }

  async function createWeekTimesheet() {
    if (!orgId) return;
    setPending(true);
    setFormError(null);
    setMessage(null);
    try {
      const start = mondayOfThisWeek();
      await api.createTimesheet({
        organizationId: orgId,
        periodStart: start,
        periodEnd: sundayOfWeek(start),
      });
      setMessage('Weekly timesheet ready.');
      await timesheetsQ.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create timesheet');
    } finally {
      setPending(false);
    }
  }

  async function submitTimesheet(id: string) {
    setPending(true);
    setFormError(null);
    try {
      await api.submitTimesheet(id);
      setMessage('Timesheet submitted.');
      await timesheetsQ.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setPending(false);
    }
  }

  async function checkIn() {
    if (!orgId) return;
    setPending(true);
    setFormError(null);
    setMessage(null);
    try {
      await api.attendanceCheckIn(orgId);
      setMessage('Checked in.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setPending(false);
    }
  }

  async function checkOut() {
    if (!orgId) return;
    setPending(true);
    setFormError(null);
    setMessage(null);
    try {
      await api.attendanceCheckOut(orgId);
      setMessage('Checked out.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Check-out failed');
    } finally {
      setPending(false);
    }
  }

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!orgId) return <OrgRequiredEmpty />;

  const timesheets = (timesheetsQ.data?.items ?? []) as Timesheet[];

  return (
    <div className="space-y-6">
      <PageHeader title="Time" subtitle="Log billable time, attendance, and weekly timesheets." />
      <div className="flex flex-wrap gap-3">
        <button type="button" className="lifeos-btn-ghost" disabled={pending} onClick={() => void checkIn()}>
          Check in
        </button>
        <button type="button" className="lifeos-btn-ghost" disabled={pending} onClick={() => void checkOut()}>
          Check out
        </button>
        <button
          type="button"
          className="lifeos-btn-ghost"
          disabled={pending}
          onClick={() => void createWeekTimesheet()}
        >
          Open this week’s timesheet
        </button>
      </div>
      <form onSubmit={onSubmit} className="lifeos-panel grid max-w-2xl gap-3 p-4 md:grid-cols-3 md:items-end">
        <div className="md:col-span-2">
          <label htmlFor="time-desc" className="mb-1 block text-xs font-medium text-slate-600">
            Description
          </label>
          <input
            id="time-desc"
            className="lifeos-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you work on?"
          />
        </div>
        <div>
          <label htmlFor="hours" className="mb-1 block text-xs font-medium text-slate-600">
            Hours
          </label>
          <input
            id="hours"
            className="lifeos-input font-mono"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <button type="submit" className="lifeos-btn-primary md:col-span-3" disabled={pending}>
          {pending ? 'Saving…' : 'Log time entry'}
        </button>
      </form>
      {message ? <p className="text-sm text-teal-800">{message}</p> : null}
      {formError ? (
        <p className="text-sm text-red-800" role="alert">
          {formError}
        </p>
      ) : null}

      <section className="lifeos-panel max-w-2xl p-4">
        <h2 className="mb-3 font-display text-lg">Timesheets</h2>
        {timesheetsQ.loading ? <LoadingBlock /> : null}
        {timesheetsQ.error ? <ErrorBlock error={timesheetsQ.error} onRetry={timesheetsQ.reload} /> : null}
        {!timesheetsQ.loading && timesheets.length === 0 ? (
          <EmptyBlock title="No timesheets" description="Open this week’s timesheet to begin." />
        ) : null}
        <ul className="divide-y divide-slate-100">
          {timesheets.map((ts) => (
            <li key={ts.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>
                {ts.period_start} → {ts.period_end}
                <span className="ml-2 uppercase text-xs text-slate-500">{ts.state}</span>
              </span>
              {ts.state === 'draft' || ts.state === 'rejected' ? (
                <button
                  type="button"
                  className="lifeos-btn-ghost"
                  disabled={pending}
                  onClick={() => void submitTimesheet(ts.id)}
                >
                  Submit
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
