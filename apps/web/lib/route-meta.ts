export type RouteMeta = {
  title: string;
  subtitle: string;
  phase: string;
};

export const ROUTE_META: Record<string, RouteMeta> = {
  '/boards': {
    title: 'Boards',
    subtitle: 'Kanban by status — scoped to your active workspace.',
    phase: 'Phase 1 · Planning',
  },
  '/calendar': {
    title: 'Calendar',
    subtitle: 'Events and time blocks across personal and org scopes.',
    phase: 'Phase 1 · Planning',
  },
  '/focus': {
    title: 'Focus',
    subtitle: 'Time blocks and deep work sessions.',
    phase: 'Phase 1 · Planning',
  },
  '/journal': {
    title: 'Journal',
    subtitle: 'Reflective writing with a calmer, airier layout.',
    phase: 'Phase 2 · Personal life',
  },
  '/notes': {
    title: 'Notes',
    subtitle: 'Quick capture and linked knowledge.',
    phase: 'Phase 2 · Personal life',
  },
  '/finance/budgets': {
    title: 'Budgets',
    subtitle: 'Envelope and category budgets for personal books.',
    phase: 'Phase 2 · Personal finance',
  },
  '/finance/correlations': {
    title: 'Finance correlations',
    subtitle: 'Rules that mirror organization income into personal books.',
    phase: 'Phase 5 · Dual finance',
  },
  '/projects': {
    title: 'Projects',
    subtitle: 'Delivery containers for client and internal work.',
    phase: 'Phase 3 · Work delivery',
  },
  '/time': {
    title: 'Time',
    subtitle: 'Timesheets and billable units.',
    phase: 'Phase 3 · Workforce',
  },
  '/capacity': {
    title: 'Capacity',
    subtitle: 'Team load and allocation forecasts.',
    phase: 'Phase 3 · Workforce',
  },
  '/crm': {
    title: 'CRM',
    subtitle: 'Accounts, contacts, and pipeline — dense table views.',
    phase: 'Phase 4 · CRM',
  },
  '/crm/opportunities': {
    title: 'Opportunities',
    subtitle: 'Deals, stages, and weighted forecasts.',
    phase: 'Phase 4 · CRM',
  },
  '/billing': {
    title: 'Billing',
    subtitle: 'Invoices, payments, and AR aging.',
    phase: 'Phase 4 · Commercial',
  },
  '/expenses': {
    title: 'Expenses',
    subtitle: 'Vendor bills and reimbursements.',
    phase: 'Phase 4 · Commercial',
  },
  '/knowledge': {
    title: 'Knowledge',
    subtitle: 'Docs, playbooks, and searchable references.',
    phase: 'Phase 5 · Knowledge',
  },
  '/reports': {
    title: 'Reports',
    subtitle: 'Cross-domain analytics and exports.',
    phase: 'Phase 5 · Reporting',
  },
  '/automations': {
    title: 'Automations',
    subtitle: 'Event-driven workflows and outbox consumers.',
    phase: 'Phase 6 · Automation',
  },
};
