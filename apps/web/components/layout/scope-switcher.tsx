'use client';

import { useScope } from '@/context/scope-context';
import clsx from 'clsx';

export function ScopeSwitcher() {
  const { me, scope, setScope, loading } = useScope();

  if (loading || !me || !scope) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-slate-200/80" aria-hidden />
    );
  }

  const options = [
    {
      type: 'PERSONAL' as const,
      id: me.personalSpaceId,
      label: me.user.display_name ?? 'Personal',
    },
    ...me.organizations.map((o) => ({
      type: 'ORGANIZATION' as const,
      id: o.organization_id,
      label: o.name,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200/80 bg-white/60 p-1">
      {options.map((opt) => {
        const active = scope.type === opt.type && scope.id === opt.id;
        return (
          <button
            key={`${opt.type}-${opt.id}`}
            type="button"
            className={clsx(
              'rounded-md px-3 py-1.5 text-xs font-medium transition',
              active
                ? 'bg-ink text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100',
            )}
            onClick={() => setScope(opt)}
            aria-pressed={active}
          >
            {opt.type === 'PERSONAL' ? 'Personal' : opt.label}
          </button>
        );
      })}
    </div>
  );
}
