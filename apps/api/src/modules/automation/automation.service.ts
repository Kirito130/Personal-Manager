import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class AutomationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
  ) {}

  async list(userId: string, scopeType: 'PERSONAL' | 'ORGANIZATION', scopeId: string) {
    await this.policy.assertScopeAccess(userId, scopeType, scopeId);
    const result = await this.db.query(
      `SELECT * FROM platform.automation_rules WHERE scope_type = $1 AND scope_id = $2 ORDER BY created_at DESC`,
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
      triggerEvent: string;
      condition?: Record<string, unknown>;
      action: Record<string, unknown>;
    },
  ) {
    await this.policy.assertScopeAccess(userId, input.scopeType, input.scopeId);
    const result = await this.db.query(
      `INSERT INTO platform.automation_rules
        (scope_type, scope_id, name, trigger_event, condition, action, created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING *`,
      [
        input.scopeType,
        input.scopeId,
        input.name,
        input.triggerEvent,
        JSON.stringify(input.condition ?? {}),
        JSON.stringify(input.action),
        userId,
      ],
    );
    return result.rows[0];
  }

  async listRuns(userId: string, ruleId: string) {
    const rule = await this.db.query(`SELECT * FROM platform.automation_rules WHERE id = $1`, [ruleId]);
    if (!rule.rows[0]) return { items: [] };
    await this.policy.assertScopeAccess(userId, rule.rows[0].scope_type, rule.rows[0].scope_id);
    const result = await this.db.query(
      `SELECT * FROM platform.automation_runs WHERE rule_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [ruleId],
    );
    return { items: result.rows };
  }
}
