import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { OutboxService } from '../../outbox/outbox.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class FocusService {
  constructor(
    private readonly db: DatabaseService,
    private readonly outbox: OutboxService,
    private readonly policy: PolicyService,
  ) {}

  async active(userId: string) {
    const result = await this.db.query(
      `SELECT * FROM planning.focus_sessions
       WHERE user_id = $1 AND status IN ('running','paused')
       ORDER BY started_at DESC LIMIT 1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async start(userId: string, taskId?: string) {
    const existing = await this.active(userId);
    if (existing) {
      throw new BadRequestException({
        code: 'FOCUS_ACTIVE',
        message: 'Finish or cancel the active focus session first',
      });
    }
    if (taskId) {
      const task = await this.db.query(`SELECT scope_type, scope_id FROM planning.tasks WHERE id=$1`, [
        taskId,
      ]);
      if (!task.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });
      await this.policy.assertScopeAccess(userId, task.rows[0].scope_type, task.rows[0].scope_id);
    }
    const result = await this.db.query(
      `INSERT INTO planning.focus_sessions (user_id, task_id, status)
       VALUES ($1,$2,'running') RETURNING *`,
      [userId, taskId ?? null],
    );
    return result.rows[0];
  }

  async pause(userId: string, sessionId: string) {
    const session = await this.requireOwned(userId, sessionId);
    if (session.status !== 'running') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Session not running' });
    }
    const result = await this.db.query(
      `UPDATE planning.focus_sessions SET status = 'paused' WHERE id = $1 RETURNING *`,
      [sessionId],
    );
    return result.rows[0];
  }

  async resume(userId: string, sessionId: string) {
    const session = await this.requireOwned(userId, sessionId);
    if (session.status !== 'paused') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Session not paused' });
    }
    const result = await this.db.query(
      `UPDATE planning.focus_sessions SET status = 'running' WHERE id = $1 RETURNING *`,
      [sessionId],
    );
    return result.rows[0];
  }

  async finish(userId: string, sessionId: string, pausedSeconds = 0) {
    const session = await this.requireOwned(userId, sessionId);
    if (!['running', 'paused'].includes(session.status)) {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Session already finished' });
    }
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    return this.db.withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE planning.focus_sessions
         SET status = 'finished', ended_at = now(), paused_seconds = paused_seconds + $2
         WHERE id = $1 RETURNING *`,
        [sessionId, pausedSeconds],
      );
      await this.outbox.enqueue(client, {
        eventName: 'focus.session_finished',
        aggregateId: sessionId,
        scope: { type: 'PERSONAL', id: spaceId },
        actorId: userId,
        payload: { taskId: session.task_id },
      });
      return updated.rows[0];
    });
  }

  private async requireOwned(userId: string, sessionId: string) {
    const result = await this.db.query(`SELECT * FROM planning.focus_sessions WHERE id = $1`, [
      sessionId,
    ]);
    if (!result.rows[0] || result.rows[0].user_id !== userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Focus session not found' });
    }
    return result.rows[0];
  }
}
