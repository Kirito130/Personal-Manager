'use client';

import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { CreateTaskSchema } from '@lifeos/contracts';
import { FormEvent, useState } from 'react';

export function CreateTaskForm({ onCreated }: { onCreated?: () => void }) {
  const { scope } = useScope();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!scope) return;
    setPending(true);
    setError(null);
    try {
      const payload = CreateTaskSchema.parse({
        scopeType: scope.type,
        scopeId: scope.id,
        title,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      await api.createTask(payload);
      setTitle('');
      setDueAt('');
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setPending(false);
    }
  }

  if (!scope) return null;

  return (
    <form onSubmit={onSubmit} className="lifeos-panel flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="task-title" className="mb-1 block text-xs font-medium text-slate-600">
          New task
        </label>
        <input
          id="task-title"
          className="lifeos-input"
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="task-due" className="mb-1 block text-xs font-medium text-slate-600">
          Due
        </label>
        <input
          id="task-due"
          type="datetime-local"
          className="lifeos-input"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </div>
      <button type="submit" className="lifeos-btn-primary" disabled={pending}>
        {pending ? 'Adding…' : 'Add task'}
      </button>
      {error ? (
        <p className="w-full text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
