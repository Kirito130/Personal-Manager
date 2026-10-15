import { Injectable, NotFoundException } from '@nestjs/common';
import { CorrelationRuleDto } from '@lifeos/contracts';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class CorrelationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
  ) {}

  async listRules(userId: string) {
    const result = await this.db.query(
      `SELECT * FROM finance_business.finance_correlation_rules
       WHERE owner_user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return { items: result.rows };
  }

  async createRule(userId: string, dto: CorrelationRuleDto) {
    await this.policy.assertOrgMember(userId, dto.organizationId);
    const result = await this.db.query(
      `INSERT INTO finance_business.finance_correlation_rules
        (owner_user_id, organization_id, target_personal_book_id, name, trigger_event,
         source_filter, target_income_account_id, target_category_id, mode)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING *`,
      [
        userId,
        dto.organizationId,
        dto.targetPersonalBookId,
        dto.name,
        dto.triggerEvent,
        JSON.stringify(dto.sourceFilter ?? {}),
        dto.targetIncomeAccountId,
        dto.targetCategoryId ?? null,
        dto.mode,
      ],
    );
    return result.rows[0];
  }

  async listLinks(userId: string) {
    const result = await this.db.query(
      `SELECT l.* FROM finance_business.finance_correlation_links l
       JOIN finance_business.finance_correlation_rules r ON r.id = l.rule_id
       WHERE r.owner_user_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [userId],
    );
    return { items: result.rows };
  }

  async confirmDraft(userId: string, linkId: string) {
    const link = await this.db.query(
      `SELECT l.*, r.owner_user_id, r.mode
       FROM finance_business.finance_correlation_links l
       JOIN finance_business.finance_correlation_rules r ON r.id = l.rule_id
       WHERE l.id = $1`,
      [linkId],
    );
    if (!link.rows[0] || link.rows[0].owner_user_id !== userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Correlation link not found' });
    }
    if (link.rows[0].status !== 'draft_created' || !link.rows[0].target_journal_id) {
      throw new NotFoundException({ code: 'INVALID_STATE', message: 'No draft to confirm' });
    }
    await this.db.query(
      `UPDATE finance_personal.financial_journals
       SET state = 'posted', posted_at = now()
       WHERE id = $1 AND state = 'draft'`,
      [link.rows[0].target_journal_id],
    );
    const updated = await this.db.query(
      `UPDATE finance_business.finance_correlation_links
       SET status = 'posted' WHERE id = $1 RETURNING *`,
      [linkId],
    );
    return updated.rows[0];
  }
}
