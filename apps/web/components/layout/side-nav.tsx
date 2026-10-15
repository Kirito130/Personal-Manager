'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Today', section: 'Command' },
  { href: '/tasks', label: 'Tasks', section: 'Command' },
  { href: '/boards', label: 'Boards', section: 'Command' },
  { href: '/calendar', label: 'Calendar', section: 'Command' },
  { href: '/focus', label: 'Focus', section: 'Command' },
  { href: '/goals', label: 'Goals', section: 'Life' },
  { href: '/habits', label: 'Habits', section: 'Life' },
  { href: '/journal', label: 'Journal', section: 'Life' },
  { href: '/notes', label: 'Notes', section: 'Life' },
  { href: '/finance', label: 'Finance', section: 'Personal $' },
  { href: '/finance/budgets', label: 'Budgets', section: 'Personal $' },
  { href: '/finance/correlations', label: 'Correlations', section: 'Personal $' },
  { href: '/projects', label: 'Projects', section: 'Work' },
  { href: '/time', label: 'Time', section: 'Work' },
  { href: '/capacity', label: 'Capacity', section: 'Work' },
  { href: '/crm', label: 'CRM', section: 'Business' },
  { href: '/crm/opportunities', label: 'Opportunities', section: 'Business' },
  { href: '/billing', label: 'Billing', section: 'Business' },
  { href: '/expenses', label: 'Expenses', section: 'Business' },
  { href: '/knowledge', label: 'Knowledge', section: 'System' },
  { href: '/reports', label: 'Reports', section: 'System' },
  { href: '/automations', label: 'Automations', section: 'System' },
  { href: '/settings', label: 'Settings', section: 'System' },
];

export function SideNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  let lastSection = '';

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" aria-label="Main">
      {NAV.map((item) => {
        const showSection = !collapsed && item.section !== lastSection;
        lastSection = item.section;
        const active =
          pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(`${item.href}/`));

        return (
          <div key={item.href}>
            {showSection ? (
              <p className="mb-1 mt-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 first:mt-0">
                {item.section}
              </p>
            ) : null}
            <Link
              href={item.href}
              className={clsx(
                'block rounded-md px-2 py-2 text-sm transition',
                collapsed && 'text-center text-xs',
                active
                  ? 'bg-teal/15 font-medium text-teal-dark'
                  : 'text-slate-700 hover:bg-white/50',
              )}
              title={collapsed ? item.label : undefined}
            >
              {collapsed ? item.label.slice(0, 1) : item.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
