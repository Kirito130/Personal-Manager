'use client';

import { ApiError } from '@/lib/api';
import clsx from 'clsx';

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="lifeos-panel p-8 text-center text-sm text-slate-600" role="status">
      {label}
    </div>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="lifeos-panel p-8 text-center">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorBlock({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message =
    error instanceof ApiError
      ? error.status === 0
        ? error.message
        : `${error.message} (${error.status})`
      : error instanceof Error
        ? error.message
        : 'Something went wrong';

  return (
    <div
      className={clsx('lifeos-panel border-red-200/80 bg-red-50/80 p-6', className)}
      role="alert"
    >
      <p className="text-sm font-medium text-red-900">Could not load data</p>
      <p className="mt-1 text-sm text-red-800">{message}</p>
      {onRetry ? (
        <button type="button" className="lifeos-btn-ghost mt-3 text-red-900" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
