import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JournalDraftDto } from '@lifeos/contracts';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class PersonalFinanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
    private readonly outbox: OutboxService,
  ) {}

  async getBook(userId: string) {
    const bookId = await this.ensureBook(userId);
    const book = await this.db.query(`SELECT * FROM finance_personal.personal_finance_books WHERE id = $1`, [
      bookId,
    ]);
    const accounts = await this.db.query(
      `SELECT * FROM finance_personal.finance_accounts WHERE book_id = $1 AND status = 'active' ORDER BY name`,
      [bookId],
    );
    const categories = await this.db.query(
      `SELECT * FROM finance_personal.finance_categories WHERE book_id = $1 ORDER BY name`,
      [bookId],
    );
    return { book: book.rows[0], accounts: accounts.rows, categories: categories.rows };
  }

  async listJournals(userId: string, limit = 50) {
    const bookId = await this.ensureBook(userId);
    const journals = await this.db.query(
      `SELECT id, event_date, state, payee, memo, posted_at, created_at, version
       FROM finance_personal.financial_journals
       WHERE book_id = $1
       ORDER BY event_date DESC, created_at DESC
       LIMIT $2`,
      [bookId, Math.min(limit, 100)],
    );
    return { items: journals.rows };
  }

  async balances(userId: string) {
    const bookId = await this.ensureBook(userId);
    const result = await this.db.query(
      `SELECT a.id, a.name, a.account_type, a.currency, a.opening_balance,
              COALESCE(SUM(CASE WHEN p.direction = 'debit' THEN p.amount ELSE -p.amount END), 0) AS movement
       FROM finance_personal.finance_accounts a
       LEFT JOIN finance_personal.financial_postings p ON p.account_id = a.id
       LEFT JOIN finance_personal.financial_journals j ON j.id = p.journal_id AND j.state = 'posted'
       WHERE a.book_id = $1
       GROUP BY a.id
       ORDER BY a.name`,
      [bookId],
    );
    return {
      items: result.rows.map((r) => ({
        ...r,
        balance: (Number(r.opening_balance) + Number(r.movement)).toFixed(6),
      })),
    };
  }

  async createDraft(userId: string, dto: JournalDraftDto) {
    const bookId = await this.ensureBook(userId);
    this.assertDraftBalance(dto);

    return this.db.withTransaction(async (client) => {
      const journal = await client.query(
        `INSERT INTO finance_personal.financial_journals
          (book_id, event_date, state, payee, memo, created_by)
         VALUES ($1,$2,'draft',$3,$4,$5) RETURNING *`,
        [bookId, dto.eventDate, dto.payee ?? null, dto.memo ?? '', userId],
      );
      for (const posting of dto.postings) {
        await client.query(
          `INSERT INTO finance_personal.financial_postings
            (journal_id, account_id, direction, amount, currency, category_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            journal.rows[0].id,
            posting.accountId,
            posting.direction,
            posting.amount,
            posting.currency,
            posting.categoryId ?? null,
          ],
        );
      }
      const postings = await client.query(
        `SELECT * FROM finance_personal.financial_postings WHERE journal_id = $1`,
        [journal.rows[0].id],
      );
      return { ...journal.rows[0], postings: postings.rows };
    });
  }

  async post(userId: string, journalId: string) {
    const bookId = await this.ensureBook(userId);
    const journal = await this.db.query(
      `SELECT * FROM finance_personal.financial_journals WHERE id = $1 AND book_id = $2`,
      [journalId, bookId],
    );
    if (!journal.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Journal not found' });
    if (journal.rows[0].state !== 'draft') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Only drafts can be posted' });
    }

    const spaceId = await this.policy.getPersonalSpaceId(userId);
    return this.db.withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE finance_personal.financial_journals
         SET state = 'posted', posted_at = now(), version = version + 1
         WHERE id = $1 RETURNING *`,
        [journalId],
      );
      await this.outbox.enqueue(client, {
        eventName: 'finance.journal_posted',
        aggregateId: journalId,
        scope: { type: 'PERSONAL', id: spaceId },
        actorId: userId,
      });
      return updated.rows[0];
    });
  }

  async reverse(userId: string, journalId: string) {
    const bookId = await this.ensureBook(userId);
    const original = await this.db.query(
      `SELECT * FROM finance_personal.financial_journals WHERE id = $1 AND book_id = $2`,
      [journalId, bookId],
    );
    if (!original.rows[0] || original.rows[0].state !== 'posted') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Only posted journals can be reversed' });
    }
    const postings = await this.db.query(
      `SELECT * FROM finance_personal.financial_postings WHERE journal_id = $1`,
      [journalId],
    );
    const spaceId = await this.policy.getPersonalSpaceId(userId);

    return this.db.withTransaction(async (client) => {
      const reversal = await client.query(
        `INSERT INTO finance_personal.financial_journals
          (book_id, event_date, state, payee, memo, reverses_journal_id, created_by)
         VALUES ($1, CURRENT_DATE, 'draft', $2, $3, $4, $5) RETURNING *`,
        [
          bookId,
          original.rows[0].payee,
          `Reversal of ${journalId}`,
          journalId,
          userId,
        ],
      );
      for (const p of postings.rows) {
        await client.query(
          `INSERT INTO finance_personal.financial_postings
            (journal_id, account_id, direction, amount, currency, category_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            reversal.rows[0].id,
            p.account_id,
            p.direction === 'debit' ? 'credit' : 'debit',
            p.amount,
            p.currency,
            p.category_id,
          ],
        );
      }
      const posted = await client.query(
        `UPDATE finance_personal.financial_journals
         SET state = 'posted', posted_at = now() WHERE id = $1 RETURNING *`,
        [reversal.rows[0].id],
      );
      await client.query(
        `UPDATE finance_personal.financial_journals SET state = 'reversed' WHERE id = $1`,
        [journalId],
      );
      await this.outbox.enqueue(client, {
        eventName: 'finance.journal_posted',
        aggregateId: posted.rows[0].id,
        scope: { type: 'PERSONAL', id: spaceId },
        actorId: userId,
        payload: { reversalOf: journalId },
      });
      return posted.rows[0];
    });
  }

  async listBudgets(userId: string) {
    const bookId = await this.ensureBook(userId);
    const plans = await this.db.query(
      `SELECT * FROM finance_personal.budget_plans WHERE book_id = $1 ORDER BY created_at DESC`,
      [bookId],
    );
    return { items: plans.rows };
  }

  async createBudget(userId: string, name: string, currency: string) {
    const bookId = await this.ensureBook(userId);
    const result = await this.db.query(
      `INSERT INTO finance_personal.budget_plans (book_id, name, currency)
       VALUES ($1,$2,$3) RETURNING *`,
      [bookId, name, currency],
    );
    return result.rows[0];
  }

  private async ensureBook(userId: string) {
    const result = await this.db.query<{ id: string }>(
      `SELECT identity.ensure_personal_finance_book($1) AS id`,
      [userId],
    );
    return result.rows[0].id;
  }

  private assertDraftBalance(dto: JournalDraftDto) {
    const byCurrency = new Map<string, { debit: number; credit: number }>();
    for (const p of dto.postings) {
      const cur = byCurrency.get(p.currency) ?? { debit: 0, credit: 0 };
      if (p.direction === 'debit') cur.debit += Number(p.amount);
      else cur.credit += Number(p.amount);
      byCurrency.set(p.currency, cur);
    }
    for (const [currency, sums] of byCurrency) {
      if (Math.abs(sums.debit - sums.credit) > 0.000001) {
        throw new BadRequestException({
          code: 'UNBALANCED',
          message: `Postings must balance for ${currency}`,
        });
      }
    }
  }
}
