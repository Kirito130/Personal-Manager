import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class CrmService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
    private readonly outbox: OutboxService,
  ) {}

  async listAccounts(userId: string, organizationId: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const result = await this.db.query(
      `SELECT * FROM crm.crm_accounts WHERE organization_id = $1 ORDER BY name`,
      [organizationId],
    );
    return { items: result.rows };
  }

  async createAccount(userId: string, organizationId: string, name: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const result = await this.db.query(
      `INSERT INTO crm.crm_accounts (organization_id, name, owner_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [organizationId, name, userId],
    );
    return result.rows[0];
  }

  async createOpportunity(
    userId: string,
    organizationId: string,
    input: { accountId: string; name: string; expectedValue?: string; currency?: string },
  ) {
    await this.policy.assertOrgMember(userId, organizationId);
    const stage = await this.db.query(
      `SELECT id FROM crm.crm_stages WHERE organization_id = $1 ORDER BY sort_order LIMIT 1`,
      [organizationId],
    );
    const result = await this.db.query(
      `INSERT INTO crm.crm_opportunities
        (organization_id, account_id, stage_id, name, expected_value, currency, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        organizationId,
        input.accountId,
        stage.rows[0]?.id ?? null,
        input.name,
        input.expectedValue ?? null,
        input.currency ?? 'USD',
        userId,
      ],
    );
    return result.rows[0];
  }

  async listOpportunities(userId: string, organizationId: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const result = await this.db.query(
      `SELECT o.*, s.name AS stage_name
       FROM crm.crm_opportunities o
       LEFT JOIN crm.crm_stages s ON s.id = o.stage_id
       WHERE o.organization_id = $1
       ORDER BY o.updated_at DESC`,
      [organizationId],
    );
    return { items: result.rows };
  }

  async convertOpportunity(userId: string, opportunityId: string, conversionKey?: string) {
    const opp = await this.db.query(`SELECT * FROM crm.crm_opportunities WHERE id = $1`, [
      opportunityId,
    ]);
    if (!opp.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Opportunity not found' });
    await this.policy.assertOrgMember(userId, opp.rows[0].organization_id);
    const key = conversionKey ?? `convert:${opportunityId}`;

    const existing = await this.db.query(
      `SELECT * FROM crm.opportunity_project_conversions WHERE opportunity_id = $1`,
      [opportunityId],
    );
    if (existing.rows[0]) {
      return { projectId: existing.rows[0].project_id, reused: true };
    }

    return this.db.withTransaction(async (client) => {
      try {
        const project = await client.query(
          `INSERT INTO planning.projects
            (scope_type, scope_id, owner_id, client_account_id, name, description, status)
           VALUES ('ORGANIZATION',$1,$2,$3,$4,$5,'active') RETURNING *`,
          [
            opp.rows[0].organization_id,
            userId,
            opp.rows[0].account_id,
            opp.rows[0].name,
            'Converted from opportunity',
          ],
        );
        await client.query(
          `INSERT INTO crm.opportunity_project_conversions
            (organization_id, opportunity_id, project_id, conversion_key, converted_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [opp.rows[0].organization_id, opportunityId, project.rows[0].id, key, userId],
        );
        await client.query(
          `UPDATE crm.crm_opportunities SET status = 'won', version = version + 1 WHERE id = $1`,
          [opportunityId],
        );
        await this.outbox.enqueue(client, {
          eventName: 'crm.opportunity_won',
          aggregateId: opportunityId,
          scope: { type: 'ORGANIZATION', id: opp.rows[0].organization_id },
          actorId: userId,
          payload: { projectId: project.rows[0].id },
        });
        return { projectId: project.rows[0].id, reused: false };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '';
        if (message.includes('opportunity_project_conversions')) {
          throw new ConflictException({
            code: 'ALREADY_CONVERTED',
            message: 'Opportunity already converted',
          });
        }
        throw err;
      }
    });
  }

  async createLead(userId: string, organizationId: string, title: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const result = await this.db.query(
      `INSERT INTO crm.crm_leads (organization_id, title, owner_id) VALUES ($1,$2,$3) RETURNING *`,
      [organizationId, title, userId],
    );
    return result.rows[0];
  }
}
