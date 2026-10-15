'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { OrgRequiredEmpty } from '@/components/ui/org-required-empty';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { CreateInvoiceSchema } from '@lifeos/contracts';
import { FormEvent, useState } from 'react';

type Account = { id: string; name: string };
type Invoice = {
  id: string;
  invoice_number: string | null;
  state: string;
  total: string;
  currency: string;
};
type Quote = {
  id: string;
  status: string;
  total: string;
  currency: string;
  account_id: string;
};

export default function BillingPage() {
  const { scope, loading: scopeLoading, error: scopeError } = useScope();
  const orgId = scope?.type === 'ORGANIZATION' ? scope.id : null;

  const invoicesQ = useApiQuery(
    () => (orgId ? api.listInvoices(orgId) : Promise.resolve({ items: [] })),
    [orgId],
  );
  const quotesQ = useApiQuery(
    () => (orgId ? api.listQuotes(orgId) : Promise.resolve({ items: [] })),
    [orgId],
  );
  const accountsQ = useApiQuery(
    () => (orgId ? api.listCrmAccounts(orgId) : Promise.resolve({ items: [] })),
    [orgId],
  );

  const [accountId, setAccountId] = useState('');
  const [lineDescription, setLineDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<'invoice' | 'quote'>('invoice');

  const accounts = (accountsQ.data?.items ?? []) as Account[];
  const selectedAccount = accountId || accounts[0]?.id || '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !selectedAccount) return;
    setPending(true);
    setFormError(null);
    try {
      if (mode === 'quote') {
        await api.createQuote({
          organizationId: orgId,
          accountId: selectedAccount,
          currency: 'USD',
          lines: [{ description: lineDescription, quantity, unitPrice }],
        });
        await quotesQ.reload();
      } else {
        const invoice = CreateInvoiceSchema.parse({
          accountId: selectedAccount,
          currency: 'USD',
          lines: [{ description: lineDescription, quantity, unitPrice }],
        });
        await api.createInvoice({ ...invoice, organizationId: orgId });
        await invoicesQ.reload();
      }
      setLineDescription('');
      setUnitPrice('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setPending(false);
    }
  }

  async function issue(id: string) {
    setPending(true);
    try {
      await api.issueInvoice(id);
      await invoicesQ.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Issue failed');
    } finally {
      setPending(false);
    }
  }

  async function accept(id: string) {
    setPending(true);
    try {
      await api.acceptQuote(id);
      await quotesQ.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Accept failed');
    } finally {
      setPending(false);
    }
  }

  if (scopeLoading) return <LoadingBlock />;
  if (scopeError) return <ErrorBlock error={scopeError} />;
  if (!orgId) return <OrgRequiredEmpty />;

  const invoices = (invoicesQ.data?.items ?? []) as Invoice[];
  const quotes = (quotesQ.data?.items ?? []) as Quote[];
  const loading = invoicesQ.loading || quotesQ.loading || accountsQ.loading;

  return (
    <div className="space-y-8">
      <PageHeader title="Billing" subtitle="Quotes and invoices for the active organization." />

      <form onSubmit={onSubmit} className="lifeos-panel mb-6 grid gap-3 p-4 md:grid-cols-2">
        <div className="flex gap-2 md:col-span-2">
          <button
            type="button"
            className={mode === 'invoice' ? 'lifeos-btn-primary' : 'lifeos-btn-ghost'}
            onClick={() => setMode('invoice')}
          >
            Invoice
          </button>
          <button
            type="button"
            className={mode === 'quote' ? 'lifeos-btn-primary' : 'lifeos-btn-ghost'}
            onClick={() => setMode('quote')}
          >
            Quote
          </button>
        </div>
        <select
          className="lifeos-input md:col-span-2"
          value={selectedAccount}
          onChange={(e) => setAccountId(e.target.value)}
          required
        >
          {accounts.length === 0 ? <option value="">Create a CRM account first</option> : null}
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          className="lifeos-input md:col-span-2"
          placeholder="Line description"
          value={lineDescription}
          onChange={(e) => setLineDescription(e.target.value)}
          required
        />
        <input
          className="lifeos-input font-mono tabular-nums"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <input
          className="lifeos-input font-mono tabular-nums"
          placeholder="Unit price"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          required
        />
        <button type="submit" className="lifeos-btn-primary md:col-span-2" disabled={pending || !selectedAccount}>
          {pending ? 'Saving…' : mode === 'quote' ? 'Create quote' : 'Create draft invoice'}
        </button>
        {formError ? (
          <p className="md:col-span-2 text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
      </form>

      {loading ? <LoadingBlock /> : null}
      {invoicesQ.error ? <ErrorBlock error={invoicesQ.error} onRetry={invoicesQ.reload} /> : null}

      <section className="lifeos-panel p-4">
        <h2 className="mb-3 font-display text-lg">Quotes</h2>
        {quotes.length === 0 ? (
          <EmptyBlock title="No quotes" description="Create a quote for a CRM account." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-mono text-xs text-slate-500">{q.id.slice(0, 8)}</span>
                  <span className="ml-2 uppercase">{q.status}</span>
                  <span className="ml-2 font-mono tabular-nums">
                    {q.total} {q.currency}
                  </span>
                </span>
                {q.status === 'draft' || q.status === 'sent' ? (
                  <button
                    type="button"
                    className="lifeos-btn-ghost"
                    disabled={pending}
                    onClick={() => void accept(q.id)}
                  >
                    Accept
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lifeos-panel p-4">
        <h2 className="mb-3 font-display text-lg">Invoices</h2>
        {invoices.length === 0 ? (
          <EmptyBlock title="No invoices" description="Create a draft, then issue it." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-medium">{inv.invoice_number ?? 'DRAFT'}</span>
                  <span className="ml-2 uppercase text-xs">{inv.state}</span>
                  <span className="ml-2 font-mono tabular-nums">
                    {inv.total} {inv.currency}
                  </span>
                </span>
                {inv.state === 'draft' || inv.state === 'pending_approval' ? (
                  <button
                    type="button"
                    className="lifeos-btn-ghost"
                    disabled={pending}
                    onClick={() => void issue(inv.id)}
                  >
                    Issue
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
