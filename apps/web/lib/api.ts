import { createBrowserAuthClient } from '@/lib/supabase/browser-auth';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typed client for the Nest domain API. All money / org / permissioned
 * reads and writes go here — never via Supabase PostgREST from the browser.
 */
function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
}

async function getAccessToken(): Promise<string | null> {
  const { auth } = createBrowserAuthClient();
  const {
    data: { session },
  } = await auth.getSession();
  return session?.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Unable to reach the LifeOS API. Is it running?', 0);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: string }).message)
        : res.statusText || 'Request failed';
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

export type MeResponse = {
  user: {
    id: string;
    email: string;
    display_name: string | null;
    locale: string | null;
    timezone: string | null;
    status: string;
  };
  personalSpaceId: string;
  organizations: Array<{
    organization_id: string;
    role: string;
    status: string;
    name: string;
    slug: string;
    base_currency: string;
  }>;
};

export type WorkspacesResponse = {
  personal: { id: string; type: 'PERSONAL' };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    base_currency: string;
    role: string;
    type: 'ORGANIZATION';
  }>;
};

export type TaskRow = {
  id: string;
  scope_type: 'PERSONAL' | 'ORGANIZATION';
  scope_id: string;
  project_id: string | null;
  title: string;
  description: string;
  status_key: string;
  status_category: string;
  priority: number;
  due_at: string | null;
  estimate_minutes: number | null;
  completed_at: string | null;
  owner_id: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type TaskListResponse = { items: TaskRow[]; nextCursor: string | null };

export type TaskDetail = TaskRow & {
  checklist: Array<{ id: string; text: string; is_complete: boolean; sort_order: number }>;
  assignees: Array<{ user_id: string; assignment_role: string }>;
};

export const api = {
  me: () => apiFetch<MeResponse>('/me'),
  workspaces: () => apiFetch<WorkspacesResponse>('/workspaces'),
  createOrganization: (body: { name: string; slug: string; currency?: string }) =>
    apiFetch<{ id: string; name: string; slug: string }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listTasks: (scopeType: string, scopeId: string, cursor?: string) => {
    const q = new URLSearchParams({ scopeType, scopeId });
    if (cursor) q.set('cursor', cursor);
    return apiFetch<TaskListResponse>(`/tasks?${q}`);
  },
  getTask: (taskId: string) => apiFetch<TaskDetail>(`/tasks/${taskId}`),
  createTask: (body: unknown) =>
    apiFetch<TaskRow>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (taskId: string, body: unknown) =>
    apiFetch<TaskRow>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  completeTask: (taskId: string, version: number) =>
    apiFetch<TaskRow>(`/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    }),
  addChecklistItem: (taskId: string, text: string) =>
    apiFetch(`/tasks/${taskId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  createGoal: (body: unknown) =>
    apiFetch('/goals', { method: 'POST', body: JSON.stringify(body) }),
  listGoals: () => apiFetch<{ items: unknown[] }>('/goals'),
  createHabit: (body: unknown) =>
    apiFetch('/habits', { method: 'POST', body: JSON.stringify(body) }),
  listHabits: () => apiFetch<{ items: unknown[] }>('/habits'),
  getPersonalFinanceBook: () => apiFetch<Record<string, unknown>>('/personal-finance/book'),
  getPersonalFinanceBalances: () =>
    apiFetch<{ items: unknown[] }>('/personal-finance/books/current/balances'),
  listFinanceJournals: () => apiFetch<{ items: unknown[] }>('/personal-finance/journals'),
  createFinanceJournalDraft: (body: unknown) =>
    apiFetch('/personal-finance/journals/drafts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postFinanceJournal: (id: string) =>
    apiFetch(`/personal-finance/journals/${id}/post`, { method: 'POST' }),
  listBudgets: () => apiFetch<{ items: unknown[] }>('/personal-finance/budgets'),
  createBudget: (body: { name: string; currency: string }) =>
    apiFetch('/personal-finance/budgets', { method: 'POST', body: JSON.stringify(body) }),
  createJournalEntry: (body: unknown) =>
    apiFetch('/personal-finance/journals/drafts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listJournalEntries: () => apiFetch<{ items: unknown[] }>('/personal-finance/journals'),
  listQuotes: (organizationId: string) => {
    const q = new URLSearchParams({ organizationId });
    return apiFetch<{ items: unknown[] }>(`/billing/quotes?${q}`);
  },
  createQuote: (body: unknown) =>
    apiFetch('/billing/quotes', { method: 'POST', body: JSON.stringify(body) }),
  acceptQuote: (id: string) => apiFetch(`/billing/quotes/${id}/accept`, { method: 'POST' }),
  listTimesheets: (organizationId: string) => {
    const q = new URLSearchParams({ organizationId });
    return apiFetch<{ items: unknown[] }>(`/timesheets?${q}`);
  },
  createTimesheet: (body: {
    organizationId: string;
    periodStart: string;
    periodEnd: string;
  }) => apiFetch('/timesheets', { method: 'POST', body: JSON.stringify(body) }),
  submitTimesheet: (id: string) => apiFetch(`/timesheets/${id}/submit`, { method: 'POST' }),
  listProjects: (scopeType: string, scopeId: string) => {
    const q = new URLSearchParams({ scopeType, scopeId });
    return apiFetch<{ items: unknown[] }>(`/projects?${q}`);
  },
  createProject: (body: unknown) =>
    apiFetch<{ id: string; boardId?: string } & Record<string, unknown>>('/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getProject: (projectId: string) => apiFetch<Record<string, unknown>>(`/projects/${projectId}`),
  getBoard: (boardId: string) => apiFetch<Record<string, unknown>>(`/boards/${boardId}`),
  listCalendarEvents: (
    scopeType: string,
    scopeId: string,
    from: string,
    to: string,
  ) => {
    const q = new URLSearchParams({ scopeType, scopeId, from, to });
    return apiFetch<{ items: unknown[] }>(`/calendar/events?${q}`);
  },
  createCalendarEvent: (body: unknown) =>
    apiFetch('/calendar/events', { method: 'POST', body: JSON.stringify(body) }),
  listTimeBlocks: (from: string, to: string) => {
    const q = new URLSearchParams({ from, to });
    return apiFetch<{ items: unknown[] }>(`/calendar/time-blocks?${q}`);
  },
  createTimeBlock: (body: unknown) =>
    apiFetch('/calendar/time-blocks', { method: 'POST', body: JSON.stringify(body) }),
  getActiveFocusSession: () => apiFetch<Record<string, unknown> | null>('/focus-sessions/active'),
  startFocusSession: (taskId?: string) =>
    apiFetch('/focus-sessions', {
      method: 'POST',
      body: JSON.stringify(taskId ? { taskId } : {}),
    }),
  pauseFocusSession: (id: string) => apiFetch(`/focus-sessions/${id}/pause`, { method: 'POST' }),
  resumeFocusSession: (id: string) => apiFetch(`/focus-sessions/${id}/resume`, { method: 'POST' }),
  finishFocusSession: (id: string, pausedSeconds?: number) =>
    apiFetch(`/focus-sessions/${id}/finish`, {
      method: 'POST',
      body: JSON.stringify(pausedSeconds != null ? { pausedSeconds } : {}),
    }),
  getJournalEntry: (localDate: string) => {
    const q = new URLSearchParams({ localDate });
    return apiFetch<Record<string, unknown> | null>(`/journal/entries?${q}`);
  },
  upsertJournalEntry: (body: { localDate: string; body: string; mood?: string }) =>
    apiFetch('/journal/entries', { method: 'POST', body: JSON.stringify(body) }),
  listNotes: () => apiFetch<{ items: unknown[] }>('/notes'),
  createNote: (body: { title: string; body?: string }) =>
    apiFetch('/notes', { method: 'POST', body: JSON.stringify(body) }),
  listCorrelationRules: () => apiFetch<{ items: unknown[] }>('/finance-correlations/rules'),
  createCorrelationRule: (body: unknown) =>
    apiFetch('/finance-correlations/rules', { method: 'POST', body: JSON.stringify(body) }),
  listCorrelationLinks: () => apiFetch<{ items: unknown[] }>('/finance-correlations/links'),
  confirmCorrelationLink: (id: string) =>
    apiFetch(`/finance-correlations/links/${id}/confirm`, { method: 'POST' }),
  createTimeEntry: (body: unknown) =>
    apiFetch('/time-entries', { method: 'POST', body: JSON.stringify(body) }),
  attendanceCheckIn: (organizationId: string) =>
    apiFetch('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ organizationId }),
    }),
  attendanceCheckOut: (organizationId: string) =>
    apiFetch('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ organizationId }),
    }),
  getCapacity: (organizationId: string, week: string) => {
    const q = new URLSearchParams({ organizationId, week });
    return apiFetch<Record<string, unknown>>(`/capacity?${q}`);
  },
  listCrmAccounts: (organizationId: string) => {
    const q = new URLSearchParams({ organizationId });
    return apiFetch<{ items: unknown[] }>(`/crm/accounts?${q}`);
  },
  createCrmAccount: (body: { organizationId: string; name: string }) =>
    apiFetch('/crm/accounts', { method: 'POST', body: JSON.stringify(body) }),
  listCrmOpportunities: (organizationId: string) => {
    const q = new URLSearchParams({ organizationId });
    return apiFetch<{ items: unknown[] }>(`/crm/opportunities?${q}`);
  },
  createCrmOpportunity: (body: unknown) =>
    apiFetch('/crm/opportunities', { method: 'POST', body: JSON.stringify(body) }),
  convertCrmOpportunity: (id: string, conversionKey?: string) =>
    apiFetch(`/crm/opportunities/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(conversionKey ? { conversionKey } : {}),
    }),
  listInvoices: (organizationId: string) => {
    const q = new URLSearchParams({ organizationId });
    return apiFetch<{ items: unknown[] }>(`/billing/invoices?${q}`);
  },
  createInvoice: (body: unknown) =>
    apiFetch('/billing/invoices', { method: 'POST', body: JSON.stringify(body) }),
  issueInvoice: (id: string) => apiFetch(`/billing/invoices/${id}/issue`, { method: 'POST' }),
  createBusinessExpense: (body: unknown) =>
    apiFetch('/business-expenses', { method: 'POST', body: JSON.stringify(body) }),
  listKnowledgeSpaces: (scopeType: string, scopeId: string) => {
    const q = new URLSearchParams({ scopeType, scopeId });
    return apiFetch<{ items: unknown[] }>(`/knowledge-spaces?${q}`);
  },
  createKnowledgeSpace: (body: unknown) =>
    apiFetch('/knowledge-spaces', { method: 'POST', body: JSON.stringify(body) }),
  listArticles: (knowledgeSpaceId: string) =>
    apiFetch<{ items: unknown[] }>(`/knowledge-spaces/${knowledgeSpaceId}/articles`),
  createArticle: (body: { knowledgeSpaceId: string; title: string; body?: string }) =>
    apiFetch('/articles', { method: 'POST', body: JSON.stringify(body) }),
  listAutomations: (scopeType: string, scopeId: string) => {
    const q = new URLSearchParams({ scopeType, scopeId });
    return apiFetch<{ items: unknown[] }>(`/automations?${q}`);
  },
  createAutomation: (body: unknown) =>
    apiFetch('/automations', { method: 'POST', body: JSON.stringify(body) }),
  createReport: (body: unknown) => apiFetch<{ id: string } & Record<string, unknown>>('/reports', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  getReport: (id: string) => apiFetch<Record<string, unknown>>(`/reports/${id}`),
  health: () => apiFetch<{ status: string }>('/health'),
};
