import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto, UpdateTaskDto } from '@lifeos/contracts';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    userId: string,
    scopeType: 'PERSONAL' | 'ORGANIZATION',
    scopeId: string,
    cursor?: string,
    limit = 50,
  ) {
    await this.policy.assertScopeAccess(userId, scopeType, scopeId);
    const params: unknown[] = [scopeType, scopeId, Math.min(limit, 100)];
    let sql = `
      SELECT id, scope_type, scope_id, project_id, title, description, status_key,
             status_category, priority, due_at, estimate_minutes, completed_at,
             owner_id, version, created_at, updated_at
      FROM planning.tasks
      WHERE scope_type = $1 AND scope_id = $2`;
    if (cursor) {
      params.push(cursor);
      sql += ` AND (created_at, id) < (
        SELECT created_at, id FROM planning.tasks WHERE id = $${params.length}
      )`;
    }
    sql += ` ORDER BY created_at DESC, id DESC LIMIT $3`;
    const result = await this.db.query(sql, params);
    return {
      items: result.rows,
      nextCursor: result.rows.at(-1)?.id ?? null,
    };
  }

  async get(userId: string, taskId: string) {
    const result = await this.db.query<{
      id: string;
      scope_type: 'PERSONAL' | 'ORGANIZATION';
      scope_id: string;
      project_id: string | null;
      status_category: string;
      completed_at: string | null;
      version: number;
      [key: string]: unknown;
    }>(`SELECT * FROM planning.tasks WHERE id = $1`, [taskId]);
    const task = result.rows[0];
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });
    await this.policy.assertScopeAccess(userId, task.scope_type, task.scope_id);
    const checklist = await this.db.query(
      `SELECT id, text, is_complete, sort_order FROM planning.task_checklist_items
       WHERE task_id = $1 ORDER BY sort_order`,
      [taskId],
    );
    const assignees = await this.db.query(
      `SELECT user_id, assignment_role FROM planning.task_assignees WHERE task_id = $1`,
      [taskId],
    );
    return { ...task, checklist: checklist.rows, assignees: assignees.rows };
  }

  async create(userId: string, dto: CreateTaskDto) {
    await this.policy.assertScopeAccess(userId, dto.scopeType, dto.scopeId);
    return this.db.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO planning.tasks
          (scope_type, scope_id, project_id, title, description, priority, due_at, estimate_minutes, owner_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          dto.scopeType,
          dto.scopeId,
          dto.projectId ?? null,
          dto.title,
          dto.description ?? '',
          dto.priority ?? 3,
          dto.dueAt ?? null,
          dto.estimateMinutes ?? null,
          userId,
        ],
      );
      const task = inserted.rows[0];
      await this.outbox.enqueue(client, {
        eventName: 'task.created',
        aggregateId: task.id,
        scope: { type: dto.scopeType, id: dto.scopeId },
        actorId: userId,
        payload: { title: task.title },
      });
      return task;
    });
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    const existing = await this.get(userId, taskId);
    if (existing.version !== dto.version) {
      throw new ConflictException({ code: 'VERSION_CONFLICT', message: 'Task was modified' });
    }

    const statusCategory = dto.statusCategory ?? existing.status_category;
    const completedAt =
      statusCategory === 'DONE'
        ? existing.completed_at ?? new Date().toISOString()
        : statusCategory === 'CANCELLED'
          ? existing.completed_at
          : null;

    return this.db.withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE planning.tasks SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          status_key = COALESCE($3, status_key),
          status_category = COALESCE($4, status_category),
          priority = COALESCE($5, priority),
          due_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE due_at END,
          estimate_minutes = CASE WHEN $8::boolean THEN $9::int ELSE estimate_minutes END,
          completed_at = $10,
          version = version + 1
         WHERE id = $11 AND version = $12
         RETURNING *`,
        [
          dto.title ?? null,
          dto.description ?? null,
          dto.statusKey ?? null,
          dto.statusCategory ?? null,
          dto.priority ?? null,
          dto.dueAt !== undefined,
          dto.dueAt ?? null,
          dto.estimateMinutes !== undefined,
          dto.estimateMinutes ?? null,
          completedAt,
          taskId,
          dto.version,
        ],
      );
      if (!updated.rows[0]) {
        throw new ConflictException({ code: 'VERSION_CONFLICT', message: 'Task was modified' });
      }
      const task = updated.rows[0];
      if (dto.statusCategory === 'DONE') {
        await this.outbox.enqueue(client, {
          eventName: 'task.completed',
          aggregateId: task.id,
          aggregateVersion: task.version,
          scope: { type: task.scope_type, id: task.scope_id },
          actorId: userId,
        });
      }
      return task;
    });
  }

  async complete(userId: string, taskId: string, version: number) {
    return this.update(userId, taskId, {
      statusKey: 'done',
      statusCategory: 'DONE',
      version,
    });
  }

  async addChecklistItem(userId: string, taskId: string, text: string) {
    await this.get(userId, taskId);
    const result = await this.db.query(
      `INSERT INTO planning.task_checklist_items (task_id, text, sort_order)
       VALUES ($1,$2, COALESCE((SELECT MAX(sort_order)+1 FROM planning.task_checklist_items WHERE task_id=$1),0))
       RETURNING *`,
      [taskId, text],
    );
    return result.rows[0];
  }

  async addSubtask(userId: string, parentId: string, title: string) {
    const parent = await this.get(userId, parentId);
    return this.db.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO planning.tasks
          (scope_type, scope_id, project_id, parent_task_id, title, owner_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [parent.scope_type, parent.scope_id, parent.project_id, parentId, title, userId],
      );
      return inserted.rows[0];
    });
  }
}
