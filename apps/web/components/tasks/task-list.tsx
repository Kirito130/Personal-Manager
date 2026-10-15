'use client';

import type { TaskRow } from '@/lib/api';
import Link from 'next/link';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

export function TaskList({ tasks }: { tasks: TaskRow[] }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <ul className="divide-y divide-slate-200/80">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-wrap items-center gap-3 py-3">
          <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 font-medium text-ink hover:text-teal-dark">
            {task.title}
          </Link>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {STATUS_LABEL[task.status_category] ?? task.status_category}
          </span>
          {task.due_at ? (
            <time className="text-xs text-slate-500" dateTime={task.due_at}>
              {new Date(task.due_at).toLocaleDateString()}
            </time>
          ) : null}
          <span className="text-xs text-slate-400">P{task.priority}</span>
        </li>
      ))}
    </ul>
  );
}
