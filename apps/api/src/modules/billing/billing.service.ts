import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
    private readonly outbox: OutboxService,
  ) {}

  async listQuotes(userId: string, organizationId: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const result = await this.db.query(
      `SELECT id, account_id, quote_number, status, currency, total, valid_until, created_at
       FROM finance_business.quotes
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return { items: result.rows };
  }

  async createQuote(
    userId: string,
    organizationId: string,
    input: {
      accountId: string;
      currency: string;
      validUntil?: string;
      notes?: string;
      lines: Array<{
        description: string;
        quantity: string;
        unitPrice: string;
        taxPct?: number;
      }>;
    },
  ) {
    await this.policy.assertOrgRoles(userId, organizationId, ['owner', 'admin', 'finance', 'member']);
    return this.db.withTransaction(async (client) => {
      let subtotal = 0;
      let taxTotal = 0;
      const computed = input.lines.map((line) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const lineSub = qty * price;
        const tax = lineSub * ((line.taxPct ?? 0) / 100);
        subtotal += lineSub;
        taxTotal += tax;
        return { ...line, lineTotal: lineSub + tax };
      });
      const total = subtotal + taxTotal;
      const quote = await client.query(
        `INSERT INTO finance_business.quotes
          (organization_id, account_id, status, currency, subtotal, tax_total, total, valid_until, notes, created_by)
         VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          organizationId,
          input.accountId,
          input.currency,
          subtotal.toFixed(6),
          taxTotal.toFixed(6),
          total.toFixed(6),
          input.validUntil ?? null,
          input.notes ?? '',
          userId,
        ],
      );
      for (const [i, line] of computed.entries()) {
        await client.query(
          `INSERT INTO finance_business.quote_lines
            (quote_id, description, quantity, unit_price, tax_pct, line_total, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            quote.rows[0].id,
            line.description,
            line.quantity,
            line.unitPrice,
            line.taxPct ?? 0,
            line.lineTotal.toFixed(6),
            i,
          ],
        );
      }
      return quote.rows[0];
    });
  }

  async acceptQuote(userId: string, quoteId: string) {
    const quote = await this.db.query(`SELECT * FROM finance_business.quotes WHERE id = $1`, [quoteId]);
    if (!quote.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Quote not found' });
    await this.policy.assertOrgRoles(userId, quote.rows[0].organization_id, [
      'owner',
      'admin',
      'finance',
    ]);
    if (quote.rows[0].status !== 'draft' && quote.rows[0].status !== 'sent') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Quote cannot be accepted' });
    }
    return this.db.withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE finance_business.quotes SET status = 'accepted', updated_at = now() WHERE id = $1 RETURNING *`,
        [quoteId],
      );
      await client.query(
        `INSERT INTO finance_business.quote_acceptances (quote_id, notes)
         VALUES ($1,'Accepted in LifeOS')
         ON CONFLICT (quote_id) DO NOTHING`,
        [quoteId],
      );
      return updated.rows[0];
    });
  }

  async createInvoice(
    userId: string,
    organizationId: string,
    input: {
      accountId: string;
      projectId?: string;
      currency: string;
      dueDate?: string;
      lines: Array<{
        description: string;
        quantity: string;
        unitPrice: string;
        taxPct?: number;
        billableUnitId?: string;
      }>;
    },
  ) {
    await this.policy.assertOrgRoles(userId, organizationId, ['owner', 'admin', 'finance']);
    let series = await this.db.query(
      `SELECT id FROM finance_business.invoice_number_series WHERE organization_id = $1 AND series_key = 'default'`,
      [organizationId],
    );
    if (!series.rows[0]) {
      series = await this.db.query(
        `INSERT INTO finance_business.invoice_number_series (organization_id) VALUES ($1) RETURNING id`,
        [organizationId],
      );
    }

    return this.db.withTransaction(async (client) => {
      let subtotal = 0;
      let taxTotal = 0;
      const computed = input.lines.map((line) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const lineSub = qty * price;
        const tax = lineSub * ((line.taxPct ?? 0) / 100);
        subtotal += lineSub;
        taxTotal += tax;
        return { ...line, lineTotal: lineSub + tax };
      });
      const total = subtotal + taxTotal;

      const invoice = await client.query(
        `INSERT INTO finance_business.invoices
          (organization_id, account_id, project_id, series_id, currency, due_date, subtotal, tax_total, total, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          organizationId,
          input.accountId,
          input.projectId ?? null,
          series.rows[0].id,
          input.currency,
          input.dueDate ?? null,
          subtotal.toFixed(6),
          taxTotal.toFixed(6),
          total.toFixed(6),
          userId,
        ],
      );

      for (const [i, line] of computed.entries()) {
        await client.query(
          `INSERT INTO finance_business.invoice_lines
            (invoice_id, description, quantity, unit_price, tax_pct, line_total, billable_unit_id, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            invoice.rows[0].id,
            line.description,
            line.quantity,
            line.unitPrice,
            line.taxPct ?? 0,
            line.lineTotal.toFixed(6),
            line.billableUnitId ?? null,
            i,
          ],
        );
      }
      return invoice.rows[0];
    });
  }

  async issueInvoice(userId: string, invoiceId: string) {
    const invoice = await this.db.query(`SELECT * FROM finance_business.invoices WHERE id = $1`, [
      invoiceId,
    ]);
    if (!invoice.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });
    await this.policy.assertOrgRoles(userId, invoice.rows[0].organization_id, [
      'owner',
      'admin',
      'finance',
    ]);
    if (invoice.rows[0].state !== 'draft' && invoice.rows[0].state !== 'pending_approval') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Invoice cannot be issued' });
    }

    return this.db.withTransaction(async (client) => {
      const numberResult = await client.query<{ number: string }>(
        `SELECT finance_business.reserve_invoice_number($1) AS number`,
        [invoice.rows[0].series_id],
      );
      const invoiceNumber = numberResult.rows[0].number;
      const lines = await client.query(
        `SELECT * FROM finance_business.invoice_lines WHERE invoice_id = $1 ORDER BY sort_order`,
        [invoiceId],
      );
      const snapshot = {
        invoice: { ...invoice.rows[0], invoice_number: invoiceNumber },
        lines: lines.rows,
      };
      const contentHash = Buffer.from(JSON.stringify(snapshot)).toString('base64url').slice(0, 64);

      const updated = await client.query(
        `UPDATE finance_business.invoices
         SET state = 'issued', invoice_number = $2, issued_at = now(), issue_date = CURRENT_DATE, version = version + 1
         WHERE id = $1 RETURNING *`,
        [invoiceId, invoiceNumber],
      );
      await client.query(
        `INSERT INTO finance_business.invoice_snapshots (invoice_id, snapshot, content_hash)
         VALUES ($1,$2::jsonb,$3)`,
        [invoiceId, JSON.stringify(snapshot), contentHash],
      );
      await client.query(
        `UPDATE workforce.billable_units bu
         SET status = 'billed'
         FROM finance_business.invoice_lines il
         WHERE il.invoice_id = $1 AND il.billable_unit_id = bu.id`,
        [invoiceId],
      );
      await this.outbox.enqueue(client, {
        eventName: 'invoice.issued',
        aggregateId: invoiceId,
        scope: { type: 'ORGANIZATION', id: invoice.rows[0].organization_id },
        actorId: userId,
        payload: { invoiceNumber },
      });
      return updated.rows[0];
    });
  }

  async recordPayment(
    userId: string,
    organizationId: string,
    input: {
      accountId: string;
      amount: string;
      currency: string;
      receivedOn: string;
      idempotencyKey: string;
      reference?: string;
    },
  ) {
    await this.policy.assertOrgRoles(userId, organizationId, ['owner', 'admin', 'finance']);
    const existing = await this.db.query(
      `SELECT * FROM finance_business.customer_payments
       WHERE organization_id = $1 AND idempotency_key = $2`,
      [organizationId, input.idempotencyKey],
    );
    if (existing.rows[0]) return existing.rows[0];

    const result = await this.db.query(
      `INSERT INTO finance_business.customer_payments
        (organization_id, account_id, amount, currency, received_on, reference, idempotency_key, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        organizationId,
        input.accountId,
        input.amount,
        input.currency,
        input.receivedOn,
        input.reference ?? null,
        input.idempotencyKey,
        userId,
      ],
    );
    return result.rows[0];
  }

  async allocatePayment(userId: string, paymentId: string, invoiceId: string, amount: string) {
    const payment = await this.db.query(`SELECT * FROM finance_business.customer_payments WHERE id = $1`, [
      paymentId,
    ]);
    if (!payment.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payment not found' });
    await this.policy.assertOrgRoles(userId, payment.rows[0].organization_id, [
      'owner',
      'admin',
      'finance',
    ]);

    return this.db.withTransaction(async (client) => {
      const allocated = await client.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM finance_business.payment_allocations WHERE payment_id = $1`,
        [paymentId],
      );
      const remaining = Number(payment.rows[0].amount) - Number(allocated.rows[0].total);
      if (Number(amount) > remaining + 0.000001) {
        throw new BadRequestException({ code: 'OVER_ALLOCATION', message: 'Exceeds unallocated payment' });
      }
      const invoice = await client.query(`SELECT * FROM finance_business.invoices WHERE id = $1 FOR UPDATE`, [
        invoiceId,
      ]);
      if (!invoice.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invoice not found' });
      const outstanding = Number(invoice.rows[0].total) - Number(invoice.rows[0].amount_paid);
      if (Number(amount) > outstanding + 0.000001) {
        throw new BadRequestException({ code: 'OVER_ALLOCATION', message: 'Exceeds invoice outstanding' });
      }

      const link = await client.query(
        `INSERT INTO finance_business.payment_allocations (payment_id, invoice_id, amount)
         VALUES ($1,$2,$3)
         ON CONFLICT (payment_id, invoice_id) DO NOTHING
         RETURNING *`,
        [paymentId, invoiceId, amount],
      );
      if (!link.rows[0]) {
        return { reused: true };
      }

      const newPaid = Number(invoice.rows[0].amount_paid) + Number(amount);
      const state =
        newPaid + 0.000001 >= Number(invoice.rows[0].total) ? 'paid' : 'partially_paid';
      await client.query(
        `UPDATE finance_business.invoices SET amount_paid = $2, state = $3 WHERE id = $1`,
        [invoiceId, newPaid.toFixed(6), state],
      );
      await this.outbox.enqueue(client, {
        eventName: 'payment.allocated',
        aggregateId: paymentId,
        scope: { type: 'ORGANIZATION', id: payment.rows[0].organization_id },
        actorId: userId,
        payload: { invoiceId, amount },
      });
      return link.rows[0];
    });
  }

  async createExpense(
    userId: string,
    organizationId: string,
    input: {
      amount: string;
      currency: string;
      expenseDate: string;
      category?: string;
      description?: string;
      projectId?: string;
      isOwnerCompensation?: boolean;
    },
  ) {
    await this.policy.assertOrgMember(userId, organizationId);
    return this.db.withTransaction(async (client) => {
      const expense = await client.query(
        `INSERT INTO finance_business.business_expenses
          (organization_id, project_id, expense_date, amount, currency, category, description, is_owner_compensation, created_by, approval_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved') RETURNING *`,
        [
          organizationId,
          input.projectId ?? null,
          input.expenseDate,
          input.amount,
          input.currency,
          input.category ?? 'general',
          input.description ?? '',
          input.isOwnerCompensation ?? false,
          userId,
        ],
      );
      if (input.isOwnerCompensation) {
        const compensation = await client.query(
          `INSERT INTO finance_business.owner_compensations
            (organization_id, owner_user_id, expense_id, amount, currency, compensation_date, status)
           VALUES ($1,$2,$3,$4,$5,$6,'recorded') RETURNING *`,
          [
            organizationId,
            userId,
            expense.rows[0].id,
            input.amount,
            input.currency,
            input.expenseDate,
          ],
        );
        await this.outbox.enqueue(client, {
          eventName: 'owner_compensation.recorded',
          aggregateId: compensation.rows[0].id,
          scope: { type: 'ORGANIZATION', id: organizationId },
          actorId: userId,
          payload: {
            amount: input.amount,
            currency: input.currency,
            expenseId: expense.rows[0].id,
            ownerUserId: userId,
          },
        });
      }
      return expense.rows[0];
    });
  }

  async listInvoices(userId: string, organizationId: string) {
    await this.policy.assertOrgMember(userId, organizationId);
    const result = await this.db.query(
      `SELECT id, invoice_number, state, currency, total, amount_paid, issue_date, due_date, created_at
       FROM finance_business.invoices WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId],
    );
    return { items: result.rows };
  }
}
