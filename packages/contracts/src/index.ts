import { z } from 'zod';

export const ScopeTypeSchema = z.enum(['PERSONAL', 'ORGANIZATION']);

export const CreateTaskSchema = z.object({
  scopeType: ScopeTypeSchema,
  scopeId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(20000).optional(),
  projectId: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  dueAt: z.string().datetime().optional(),
  estimateMinutes: z.number().int().min(0).optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).optional(),
  statusKey: z.string().optional(),
  statusCategory: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'])
    .optional(),
  priority: z.number().int().min(1).max(5).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  estimateMinutes: z.number().int().min(0).nullable().optional(),
  version: z.number().int().positive(),
});

export const CreateCalendarEventSchema = z.object({
  scopeType: ScopeTypeSchema,
  scopeId: z.string().uuid(),
  title: z.string().min(1).max(500),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
  allDay: z.boolean().optional(),
  description: z.string().optional(),
});

export const CreateTimeBlockSchema = z.object({
  scopeType: ScopeTypeSchema,
  scopeId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  title: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
});

export const CreateGoalSchema = z.object({
  title: z.string().min(1).max(500),
  areaId: z.string().uuid().optional(),
  target: z.string().optional(),
  baseline: z.string().optional(),
  dueOn: z.string().optional(),
  rationale: z.string().optional(),
});

export const CreateHabitSchema = z.object({
  title: z.string().min(1).max(500),
  scheduleRule: z.string().default('FREQ=DAILY'),
  targetCount: z.number().int().positive().default(1),
});

export const JournalDraftSchema = z.object({
  eventDate: z.string(),
  payee: z.string().optional(),
  memo: z.string().optional(),
  postings: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        direction: z.enum(['debit', 'credit']),
        amount: z.string(),
        currency: z.string().length(3),
        categoryId: z.string().uuid().optional(),
      }),
    )
    .min(2),
});

export const CreateProjectSchema = z.object({
  scopeType: ScopeTypeSchema,
  scopeId: z.string().uuid(),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  clientAccountId: z.string().uuid().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
});

export const CreateInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  currency: z.string().length(3),
  dueDate: z.string().optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.string(),
        unitPrice: z.string(),
        taxPct: z.number().optional(),
        billableUnitId: z.string().uuid().optional(),
      }),
    )
    .min(1),
});

export const CorrelationRuleSchema = z.object({
  organizationId: z.string().uuid(),
  targetPersonalBookId: z.string().uuid(),
  name: z.string().min(1),
  triggerEvent: z.string().min(1),
  targetIncomeAccountId: z.string().uuid(),
  targetCategoryId: z.string().uuid().optional(),
  mode: z.enum(['AUTO_POST', 'CREATE_DRAFT', 'SUGGEST_ONLY']).default('CREATE_DRAFT'),
  sourceFilter: z.record(z.unknown()).optional(),
});

export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
export type JournalDraftDto = z.infer<typeof JournalDraftSchema>;
export type CorrelationRuleDto = z.infer<typeof CorrelationRuleSchema>;
