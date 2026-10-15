import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';

type OutboxEvent = {
  id: string;
  event_name: string;
  aggregate_id: string;
  scope_type: string;
  scope_id: string;
  actor_id: string | null;
  correlation_id: string;
  payload: {
    amount?: string;
    currency?: string;
    ownerUserId?: string;
    expenseId?: string;
  };
};

/**
 * Applies owner-gated finance correlation rules:
 * business owner compensation → personal income journal (draft by default).
 */
export async function handleOwnerCompensation(client: PoolClient, event: OutboxEvent) {
  const ownerUserId = event.payload.ownerUserId ?? event.actor_id;
  if (!ownerUserId || !event.payload.amount || !event.payload.currency) return;

  const rules = await client.query(
    `SELECT * FROM finance_business.finance_correlation_rules
     WHERE organization_id = $1
       AND owner_user_id = $2
       AND trigger_event = 'owner_compensation.recorded'
       AND enabled = true`,
    [event.scope_id, ownerUserId],
  );

  for (const rule of rules.rows) {
    const existing = await client.query(
      `SELECT id FROM finance_business.finance_correlation_links
       WHERE source_kind = 'owner_compensation' AND source_id = $1 AND rule_id = $2`,
      [event.aggregate_id, rule.id],
    );
    if (existing.rows[0]) continue;

    if (rule.mode === 'SUGGEST_ONLY') {
      await client.query(
        `INSERT INTO finance_business.finance_correlation_links
          (rule_id, source_kind, source_id, amount, currency, status, correlation_id)
         VALUES ($1,'owner_compensation',$2,$3,$4,'pending',$5)`,
        [rule.id, event.aggregate_id, event.payload.amount, event.payload.currency, event.correlation_id],
      );
      continue;
    }

    // Find a balancing asset/checking account in the personal book
    const cashAccount = await client.query(
      `SELECT id FROM finance_personal.finance_accounts
       WHERE book_id = $1 AND account_type = 'asset' AND status = 'active'
       ORDER BY CASE WHEN subtype = 'checking' THEN 0 ELSE 1 END
       LIMIT 1`,
      [rule.target_personal_book_id],
    );
    if (!cashAccount.rows[0]) {
      await client.query(
        `INSERT INTO finance_business.finance_correlation_links
          (rule_id, source_kind, source_id, amount, currency, status, correlation_id, error_message)
         VALUES ($1,'owner_compensation',$2,$3,$4,'failed',$5,'No personal asset account')`,
        [
          rule.id,
          event.aggregate_id,
          event.payload.amount,
          event.payload.currency,
          event.correlation_id,
        ],
      );
      continue;
    }

    const journalState = rule.mode === 'AUTO_POST' ? 'posted' : 'draft';
    const journal = await client.query(
      `INSERT INTO finance_personal.financial_journals
        (book_id, event_date, state, payee, memo, correlation_id, created_by, posted_at)
       VALUES ($1, CURRENT_DATE, $2, 'Work salary', $3, $4, $5, CASE WHEN $2 = 'posted' THEN now() ELSE NULL END)
       RETURNING id`,
      [
        rule.target_personal_book_id,
        journalState,
        `Linked from business compensation ${event.aggregate_id}`,
        event.correlation_id,
        ownerUserId,
      ],
    );

    await client.query(
      `INSERT INTO finance_personal.financial_postings
        (journal_id, account_id, direction, amount, currency, category_id)
       VALUES
        ($1,$2,'debit',$4,$5,NULL),
        ($1,$3,'credit',$4,$5,$6)`,
      [
        journal.rows[0].id,
        cashAccount.rows[0].id,
        rule.target_income_account_id,
        event.payload.amount,
        event.payload.currency,
        rule.target_category_id,
      ],
    );

    await client.query(
      `INSERT INTO finance_business.finance_correlation_links
        (rule_id, source_kind, source_id, target_journal_id, amount, currency, status, correlation_id)
       VALUES ($1,'owner_compensation',$2,$3,$4,$5,$6,$7)
       ON CONFLICT (source_kind, source_id, rule_id) DO NOTHING`,
      [
        rule.id,
        event.aggregate_id,
        journal.rows[0].id,
        event.payload.amount,
        event.payload.currency,
        journalState === 'posted' ? 'posted' : 'draft_created',
        event.correlation_id || randomUUID(),
      ],
    );
  }
}
