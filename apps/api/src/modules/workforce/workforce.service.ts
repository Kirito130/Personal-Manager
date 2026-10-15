import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class WorkforceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
    private readonly outbox: OutboxService,
  ) {}

  async listTimesheets(userId: string, organizationId: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const result = await this.db.query(
      `SELECT * FROM workforce.timesheets
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY period_start DESC
       LIMIT 20`,
      [organizationId, userId],
    );
    return { items: result.rows };
  }

  async createTimesheet(
    userId: string,
    organizationId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    await this.policy.assertOrgMember(userId, organizationId);
    const result = await this.db.query(
      `INSERT INTO workforce.timesheets (organization_id, user_id, period_start, period_end)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (organization_id, user_id, period_start)
       DO UPDATE SET updated_at = now()
       RETURNING *`,
      [organizationId, userId, periodStart, periodEnd],
    );
    return result.rows[0];
  }

  async attachTimeEntryToTimesheet(userId: string, timesheetId: string, timeEntryId: string) {
    const ts = await this.db.query(`SELECT * FROM workforce.timesheets WHERE id = $1`, [timesheetId]);
    if (!ts.rows[0] || ts.rows[0].user_id !== userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Timesheet not found' });
    }
    if (ts.rows[0].state !== 'draft' && ts.rows[0].state !== 'rejected') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Timesheet is locked' });
    }
    const entry = await this.db.query(`SELECT * FROM workforce.time_entries WHERE id = $1`, [
      timeEntryId,
    ]);
    if (!entry.rows[0] || entry.rows[0].user_id !== userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Time entry not found' });
    }
    const link = await this.db.query(
      `INSERT INTO workforce.timesheet_lines (timesheet_id, time_entry_id)
       VALUES ($1,$2)
       ON CONFLICT (time_entry_id) DO NOTHING
       RETURNING *`,
      [timesheetId, timeEntryId],
    );
    return link.rows[0] ?? { timesheet_id: timesheetId, time_entry_id: timeEntryId, reused: true };
  }

  async createTimeEntry(
    userId: string,
    organizationId: string,
    input: {
      projectId?: string;
      taskId?: string;
      startedAt: string;
      endedAt: string;
      description?: string;
      billable?: boolean;
    },
  ) {
    await this.policy.assertOrgMember(userId, organizationId);
    const minutes = Math.round(
      (new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()) / 60000,
    );
    if (minutes < 0) throw new BadRequestException({ code: 'INVALID_RANGE', message: 'Invalid interval' });
    const result = await this.db.query(
      `INSERT INTO workforce.time_entries
        (organization_id, user_id, project_id, task_id, started_at, ended_at, duration_minutes, description, billable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        organizationId,
        userId,
        input.projectId ?? null,
        input.taskId ?? null,
        input.startedAt,
        input.endedAt,
        minutes,
        input.description ?? '',
        input.billable ?? false,
      ],
    );
    return result.rows[0];
  }

  async submitTimesheet(userId: string, timesheetId: string) {
    const ts = await this.db.query(`SELECT * FROM workforce.timesheets WHERE id = $1`, [timesheetId]);
    if (!ts.rows[0] || ts.rows[0].user_id !== userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Timesheet not found' });
    }
    if (ts.rows[0].state !== 'draft' && ts.rows[0].state !== 'rejected') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Cannot submit' });
    }
    return this.db.withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE workforce.timesheets SET state = 'submitted', submitted_at = now(), version = version + 1
         WHERE id = $1 RETURNING *`,
        [timesheetId],
      );
      await this.outbox.enqueue(client, {
        eventName: 'timesheet.submitted',
        aggregateId: timesheetId,
        scope: { type: 'ORGANIZATION', id: ts.rows[0].organization_id },
        actorId: userId,
      });
      return updated.rows[0];
    });
  }

  async approveTimesheet(approverId: string, timesheetId: string, decision: 'approved' | 'rejected', reason = '') {
    const ts = await this.db.query(`SELECT * FROM workforce.timesheets WHERE id = $1`, [timesheetId]);
    if (!ts.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Timesheet not found' });
    await this.policy.assertOrgRoles(approverId, ts.rows[0].organization_id, [
      'owner',
      'admin',
      'project_manager',
    ]);
    if (ts.rows[0].state !== 'submitted') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Timesheet not submitted' });
    }
    return this.db.withTransaction(async (client) => {
      const state = decision === 'approved' ? 'approved' : 'rejected';
      const updated = await client.query(
        `UPDATE workforce.timesheets SET state = $2, locked_at = CASE WHEN $2 = 'approved' THEN now() ELSE locked_at END
         WHERE id = $1 RETURNING *`,
        [timesheetId, state],
      );
      await client.query(
        `INSERT INTO workforce.timesheet_approvals (timesheet_id, approver_id, decision, reason)
         VALUES ($1,$2,$3,$4)`,
        [timesheetId, approverId, decision, reason],
      );
      if (decision === 'approved') {
        const lines = await client.query(
          `SELECT te.* FROM workforce.timesheet_lines tl
           JOIN workforce.time_entries te ON te.id = tl.time_entry_id
           WHERE tl.timesheet_id = $1 AND te.billable = true`,
          [timesheetId],
        );
        for (const entry of lines.rows) {
          await client.query(
            `INSERT INTO workforce.billable_units
              (organization_id, source_kind, source_id, quantity, unit, currency, project_id, status)
             VALUES ($1,'time_entry',$2,$3,'hour',$4,$5,'available')
             ON CONFLICT (organization_id, source_kind, source_id) DO NOTHING`,
            [
              entry.organization_id,
              entry.id,
              (entry.duration_minutes / 60).toFixed(6),
              'USD',
              entry.project_id,
            ],
          );
        }
        await this.outbox.enqueue(client, {
          eventName: 'timesheet.approved',
          aggregateId: timesheetId,
          scope: { type: 'ORGANIZATION', id: ts.rows[0].organization_id },
          actorId: approverId,
        });
      }
      return updated.rows[0];
    });
  }

  async checkIn(userId: string, organizationId: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const resource = await this.ensureResource(userId, organizationId);
    const open = await this.db.query(
      `SELECT id FROM workforce.attendance_sessions WHERE resource_id = $1 AND status = 'open'`,
      [resource.id],
    );
    if (open.rows[0]) {
      throw new BadRequestException({ code: 'ALREADY_CHECKED_IN', message: 'Already checked in' });
    }
    const result = await this.db.query(
      `INSERT INTO workforce.attendance_sessions (organization_id, resource_id, checked_in_at)
       VALUES ($1,$2,now()) RETURNING *`,
      [organizationId, resource.id],
    );
    return result.rows[0];
  }

  async checkOut(userId: string, organizationId: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const resource = await this.ensureResource(userId, organizationId);
    const result = await this.db.query(
      `UPDATE workforce.attendance_sessions
       SET checked_out_at = now(), status = 'closed'
       WHERE resource_id = $1 AND status = 'open'
       RETURNING *`,
      [resource.id],
    );
    if (!result.rows[0]) {
      throw new BadRequestException({ code: 'NOT_CHECKED_IN', message: 'No open attendance session' });
    }
    return result.rows[0];
  }

  async capacity(userId: string, organizationId: string, weekStart: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const resources = await this.db.query(
      `SELECT id, display_name, utilization_goal_pct FROM workforce.people_resources
       WHERE organization_id = $1 AND status = 'active'`,
      [organizationId],
    );
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const allocations = await this.db.query(
      `SELECT resource_id, SUM(COALESCE(hours_per_week, allocation_pct * 0.4, 0)) AS allocated_hours
       FROM workforce.resource_allocations
       WHERE organization_id = $1 AND period_start <= $3::date AND period_end >= $2::date
       GROUP BY resource_id`,
      [organizationId, weekStart, weekEnd.toISOString().slice(0, 10)],
    );
    const leave = await this.db.query(
      `SELECT resource_id, SUM(COALESCE(hours, 8)) AS leave_hours
       FROM workforce.leave_requests
       WHERE organization_id = $1 AND status = 'approved'
         AND starts_on <= $3::date AND ends_on >= $2::date
       GROUP BY resource_id`,
      [organizationId, weekStart, weekEnd.toISOString().slice(0, 10)],
    );
    const allocMap = new Map(allocations.rows.map((r) => [r.resource_id, Number(r.allocated_hours)]));
    const leaveMap = new Map(leave.rows.map((r) => [r.resource_id, Number(r.leave_hours)]));
    return {
      weekStart,
      items: resources.rows.map((r) => {
        const available = Math.max(0, 40 - (leaveMap.get(r.id) ?? 0));
        const allocated = allocMap.get(r.id) ?? 0;
        return {
          resourceId: r.id,
          displayName: r.display_name,
          availableHours: available,
          allocatedHours: allocated,
          overloaded: allocated > available,
        };
      }),
    };
  }

  private async ensureResource(userId: string, organizationId: string) {
    const existing = await this.db.query(
      `SELECT * FROM workforce.people_resources WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId],
    );
    if (existing.rows[0]) return existing.rows[0];
    const profile = await this.db.query(`SELECT display_name FROM identity.profiles WHERE id = $1`, [
      userId,
    ]);
    const created = await this.db.query(
      `INSERT INTO workforce.people_resources (organization_id, user_id, display_name)
       VALUES ($1,$2,$3) RETURNING *`,
      [organizationId, userId, profile.rows[0]?.display_name ?? 'Member'],
    );
    return created.rows[0];
  }
}
