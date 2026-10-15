import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class CalendarService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
    private readonly outbox: OutboxService,
  ) {}

  async listEvents(
    userId: string,
    scopeType: 'PERSONAL' | 'ORGANIZATION',
    scopeId: string,
    from: string,
    to: string,
  ) {
    await this.policy.assertScopeAccess(userId, scopeType, scopeId);
    const result = await this.db.query(
      `SELECT * FROM planning.calendar_events
       WHERE scope_type = $1 AND scope_id = $2
         AND starts_at < $4::timestamptz AND ends_at > $3::timestamptz
       ORDER BY starts_at`,
      [scopeType, scopeId, from, to],
    );
    return { items: result.rows };
  }

  async createEvent(
    userId: string,
    input: {
      scopeType: 'PERSONAL' | 'ORGANIZATION';
      scopeId: string;
      title: string;
      startsAt: string;
      endsAt: string;
      timezone: string;
      allDay?: boolean;
      description?: string;
    },
  ) {
    await this.policy.assertScopeAccess(userId, input.scopeType, input.scopeId);
    if (new Date(input.endsAt) < new Date(input.startsAt)) {
      throw new BadRequestException({ code: 'INVALID_RANGE', message: 'endsAt must be >= startsAt' });
    }
    const result = await this.db.query(
      `INSERT INTO planning.calendar_events
        (scope_type, scope_id, owner_id, title, description, starts_at, ends_at, timezone, all_day)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        input.scopeType,
        input.scopeId,
        userId,
        input.title,
        input.description ?? '',
        input.startsAt,
        input.endsAt,
        input.timezone,
        input.allDay ?? false,
      ],
    );
    return result.rows[0];
  }

  async createTimeBlock(
    userId: string,
    input: {
      scopeType: 'PERSONAL' | 'ORGANIZATION';
      scopeId: string;
      taskId?: string;
      title?: string;
      startsAt: string;
      endsAt: string;
      timezone: string;
    },
  ) {
    await this.policy.assertScopeAccess(userId, input.scopeType, input.scopeId);
    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new BadRequestException({ code: 'INVALID_RANGE', message: 'Invalid time block range' });
    }

    // Conflict flag: overlapping blocks for same owner
    const conflicts = await this.db.query(
      `SELECT id, starts_at, ends_at FROM planning.time_blocks
       WHERE owner_id = $1 AND starts_at < $3::timestamptz AND ends_at > $2::timestamptz`,
      [userId, input.startsAt, input.endsAt],
    );

    return this.db.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO planning.time_blocks
          (owner_id, scope_type, scope_id, task_id, title, starts_at, ends_at, timezone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          userId,
          input.scopeType,
          input.scopeId,
          input.taskId ?? null,
          input.title ?? null,
          input.startsAt,
          input.endsAt,
          input.timezone,
        ],
      );
      const block = inserted.rows[0];
      await this.outbox.enqueue(client, {
        eventName: 'calendar.block_changed',
        aggregateId: block.id,
        scope: { type: input.scopeType, id: input.scopeId },
        actorId: userId,
        payload: { action: 'created' },
      });
      return { ...block, conflicts: conflicts.rows };
    });
  }

  async listTimeBlocks(userId: string, from: string, to: string) {
    const result = await this.db.query(
      `SELECT * FROM planning.time_blocks
       WHERE owner_id = $1 AND starts_at < $3::timestamptz AND ends_at > $2::timestamptz
       ORDER BY starts_at`,
      [userId, from, to],
    );
    return { items: result.rows };
  }

  async getEvent(userId: string, eventId: string) {
    const result = await this.db.query(`SELECT * FROM planning.calendar_events WHERE id = $1`, [
      eventId,
    ]);
    if (!result.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Event not found' });
    await this.policy.assertScopeAccess(
      userId,
      result.rows[0].scope_type,
      result.rows[0].scope_id,
    );
    return result.rows[0];
  }
}
