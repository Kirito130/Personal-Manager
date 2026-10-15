import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
  ) {}

  async list(userId: string, scopeType: 'PERSONAL' | 'ORGANIZATION', scopeId: string) {
    await this.policy.assertScopeAccess(userId, scopeType, scopeId);
    const result = await this.db.query(
      `SELECT * FROM planning.projects WHERE scope_type = $1 AND scope_id = $2 ORDER BY updated_at DESC`,
      [scopeType, scopeId],
    );
    return { items: result.rows };
  }

  async create(
    userId: string,
    input: {
      scopeType: 'PERSONAL' | 'ORGANIZATION';
      scopeId: string;
      name: string;
      description?: string;
      clientAccountId?: string;
      plannedStart?: string;
      plannedEnd?: string;
    },
  ) {
    await this.policy.assertScopeAccess(userId, input.scopeType, input.scopeId);
    return this.db.withTransaction(async (client) => {
      const project = await client.query(
        `INSERT INTO planning.projects
          (scope_type, scope_id, owner_id, name, description, client_account_id, planned_start, planned_end)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          input.scopeType,
          input.scopeId,
          userId,
          input.name,
          input.description ?? '',
          input.clientAccountId ?? null,
          input.plannedStart ?? null,
          input.plannedEnd ?? null,
        ],
      );
      const board = await client.query(
        `INSERT INTO planning.boards (scope_type, scope_id, project_id, name)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [input.scopeType, input.scopeId, project.rows[0].id, 'Main'],
      );
      for (const [i, col] of [
        ['Backlog', 'NOT_STARTED'],
        ['Doing', 'IN_PROGRESS'],
        ['Blocked', 'BLOCKED'],
        ['Done', 'DONE'],
      ].entries()) {
        await client.query(
          `INSERT INTO planning.board_columns (board_id, name, status_category, sort_order)
           VALUES ($1,$2,$3,$4)`,
          [board.rows[0].id, col[0], col[1], i],
        );
      }
      return { ...project.rows[0], boardId: board.rows[0].id };
    });
  }

  async get(userId: string, projectId: string) {
    const result = await this.db.query(`SELECT * FROM planning.projects WHERE id = $1`, [projectId]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project not found' });
    await this.policy.assertScopeAccess(
      userId,
      result.rows[0].scope_type,
      result.rows[0].scope_id,
    );
    const milestones = await this.db.query(
      `SELECT * FROM planning.milestones WHERE project_id = $1 ORDER BY due_at NULLS LAST`,
      [projectId],
    );
    const tasks = await this.db.query(
      `SELECT id, title, status_category, priority, due_at, estimate_minutes
       FROM planning.tasks WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return { ...result.rows[0], milestones: milestones.rows, tasks: tasks.rows };
  }

  async addMilestone(userId: string, projectId: string, title: string, dueAt?: string) {
    await this.get(userId, projectId);
    const result = await this.db.query(
      `INSERT INTO planning.milestones (project_id, title, due_at) VALUES ($1,$2,$3) RETURNING *`,
      [projectId, title, dueAt ?? null],
    );
    return result.rows[0];
  }

  async timeline(userId: string, projectId: string) {
    const project = await this.get(userId, projectId);
    return {
      projectId,
      milestones: project.milestones,
      tasks: project.tasks.map((t) => ({
        id: String(t.id),
        title: String(t.title),
        dueAt: (t.due_at as string | null) ?? null,
        estimateMinutes: (t.estimate_minutes as number | null) ?? null,
        statusCategory: String(t.status_category),
      })),
    };
  }

  async getBoard(userId: string, boardId: string) {
    const board = await this.db.query(`SELECT * FROM planning.boards WHERE id = $1`, [boardId]);
    if (!board.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Board not found' });
    await this.policy.assertScopeAccess(userId, board.rows[0].scope_type, board.rows[0].scope_id);
    const columns = await this.db.query(
      `SELECT * FROM planning.board_columns WHERE board_id = $1 ORDER BY sort_order`,
      [boardId],
    );
    const tasks = await this.db.query(
      `SELECT id, title, status_category, priority, project_id, version
       FROM planning.tasks
       WHERE scope_type = $1 AND scope_id = $2
         AND ($3::uuid IS NULL OR project_id = $3)
         AND status_category <> 'CANCELLED'
       ORDER BY priority, created_at`,
      [board.rows[0].scope_type, board.rows[0].scope_id, board.rows[0].project_id],
    );
    return {
      board: board.rows[0],
      columns: columns.rows.map((col) => ({
        ...col,
        tasks: tasks.rows.filter((t) => t.status_category === col.status_category),
      })),
    };
  }
}
