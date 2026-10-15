import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
  ) {}

  async createDefinition(
    userId: string,
    input: {
      scopeType: 'PERSONAL' | 'ORGANIZATION';
      scopeId: string;
      name: string;
      reportType: string;
      definition: Record<string, unknown>;
    },
  ) {
    await this.policy.assertScopeAccess(userId, input.scopeType, input.scopeId);
    const result = await this.db.query(
      `INSERT INTO collaboration.report_definitions
        (scope_type, scope_id, name, report_type, definition, created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING *`,
      [
        input.scopeType,
        input.scopeId,
        input.name,
        input.reportType,
        JSON.stringify(input.definition),
        userId,
      ],
    );
    return result.rows[0];
  }

  async getReport(userId: string, reportId: string) {
    const def = await this.db.query(
      `SELECT * FROM collaboration.report_definitions WHERE id = $1`,
      [reportId],
    );
    if (!def.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Report not found' });
    await this.policy.assertScopeAccess(userId, def.rows[0].scope_type, def.rows[0].scope_id);

    let payload: Record<string, unknown> = {
      unit: 'count',
      calculation: 'derived_from_canonical',
      scope: { type: def.rows[0].scope_type, id: def.rows[0].scope_id },
      asOf: new Date().toISOString(),
    };

    if (def.rows[0].report_type === 'task_completion') {
      const stats = await this.db.query(
        `SELECT status_category, COUNT(*)::int AS count
         FROM planning.tasks
         WHERE scope_type = $1 AND scope_id = $2
         GROUP BY status_category`,
        [def.rows[0].scope_type, def.rows[0].scope_id],
      );
      payload = { ...payload, rows: stats.rows };
    } else if (def.rows[0].report_type === 'personal_cashflow' && def.rows[0].scope_type === 'PERSONAL') {
      await this.policy.assertPersonalScope(userId, def.rows[0].scope_id);
      const books = await this.db.query(
        `SELECT id FROM finance_personal.personal_finance_books WHERE personal_space_id = $1`,
        [def.rows[0].scope_id],
      );
      if (books.rows[0]) {
        const flow = await this.db.query(
          `SELECT a.account_type, SUM(p.amount) AS total
           FROM finance_personal.financial_postings p
           JOIN finance_personal.financial_journals j ON j.id = p.journal_id AND j.state = 'posted'
           JOIN finance_personal.finance_accounts a ON a.id = p.account_id
           WHERE a.book_id = $1 AND a.account_type IN ('income','expense')
           GROUP BY a.account_type`,
          [books.rows[0].id],
        );
        payload = { ...payload, accountingBasis: 'cash', rows: flow.rows };
      }
    }

    const snapshot = await this.db.query(
      `INSERT INTO collaboration.report_snapshots (report_definition_id, payload)
       VALUES ($1,$2::jsonb) RETURNING *`,
      [reportId, JSON.stringify(payload)],
    );
    return { definition: def.rows[0], snapshot: snapshot.rows[0] };
  }
}
