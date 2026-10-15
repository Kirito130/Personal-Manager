import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
  ) {}

  async today(userId: string, scopeType: 'PERSONAL' | 'ORGANIZATION', scopeId: string, localDate: string) {
    await this.policy.assertScopeAccess(userId, scopeType, scopeId);
    const dayStart = `${localDate}T00:00:00.000Z`;
    const dayEnd = `${localDate}T23:59:59.999Z`;

    const tasks = await this.db.query(
      `SELECT id, title, status_category, priority, due_at, estimate_minutes, version
       FROM planning.tasks
       WHERE scope_type = $1 AND scope_id = $2
         AND status_category NOT IN ('DONE','CANCELLED')
         AND (due_at IS NULL OR due_at::date <= $3::date)
       ORDER BY priority ASC, due_at ASC NULLS LAST
       LIMIT 50`,
      [scopeType, scopeId, localDate],
    );

    const events = await this.db.query(
      `SELECT id, title, starts_at, ends_at, all_day
       FROM planning.calendar_events
       WHERE scope_type = $1 AND scope_id = $2
         AND starts_at <= $4::timestamptz AND ends_at >= $3::timestamptz
       ORDER BY starts_at`,
      [scopeType, scopeId, dayStart, dayEnd],
    );

    const blocks = await this.db.query(
      `SELECT id, title, task_id, starts_at, ends_at, status
       FROM planning.time_blocks
       WHERE owner_id = $1
         AND starts_at <= $3::timestamptz AND ends_at >= $2::timestamptz
       ORDER BY starts_at`,
      [userId, dayStart, dayEnd],
    );

    const focus = await this.db.query(
      `SELECT id, task_id, started_at, status, paused_seconds
       FROM planning.focus_sessions
       WHERE user_id = $1 AND status IN ('running','paused')
       LIMIT 1`,
      [userId],
    );

    const estimatedMinutes = tasks.rows.reduce(
      (sum, t) => sum + (t.estimate_minutes ?? 0),
      0,
    );

    return {
      localDate,
      scopeType,
      scopeId,
      tasks: tasks.rows,
      events: events.rows,
      timeBlocks: blocks.rows,
      activeFocus: focus.rows[0] ?? null,
      estimatedWorkloadMinutes: estimatedMinutes,
    };
  }

  async home(userId: string, scopeType: 'PERSONAL' | 'ORGANIZATION', scopeId: string, localDate: string) {
    const today = await this.today(userId, scopeType, scopeId, localDate);
    const notifications = await this.db.query(
      `SELECT n.id, n.category, n.title, n.body, n.created_at, r.read_at
       FROM platform.notifications n
       LEFT JOIN platform.notification_receipts r
         ON r.notification_id = n.id AND r.recipient_id = $1
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT 10`,
      [userId],
    );
    return { ...today, notifications: notifications.rows };
  }

  async search(userId: string, q: string, scopeType: 'PERSONAL' | 'ORGANIZATION', scopeId: string) {
    await this.policy.assertScopeAccess(userId, scopeType, scopeId);
    const query = q.trim();
    if (!query) return { items: [] };

    const tasks = await this.db.query(
      `SELECT id, title, 'task' AS kind FROM planning.tasks
       WHERE scope_type = $1 AND scope_id = $2
         AND search_vector @@ plainto_tsquery('english', $3)
       LIMIT 20`,
      [scopeType, scopeId, query],
    );

    // Never search journal bodies into shared results
    const notes =
      scopeType === 'PERSONAL'
        ? await this.db.query(
            `SELECT id, title, 'note' AS kind FROM personal.notes
             WHERE scope_type = $1 AND scope_id = $2
               AND search_vector @@ plainto_tsquery('english', $3)
             LIMIT 20`,
            [scopeType, scopeId, query],
          )
        : { rows: [] };

    return { items: [...tasks.rows, ...notes.rows] };
  }
}
