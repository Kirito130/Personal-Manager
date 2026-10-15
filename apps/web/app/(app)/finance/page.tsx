'use client';

import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/api-state';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api-query';
import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

type Account = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
};

type BookPayload = {
  book: { id: string; name: string; base_currency: string };
  accounts: Account[];
  categories: unknown[];
};

type Journal = {
  id: string;
  event_date: string;
  state: string;
  payee: string | null;
  memo: string;
};

export default function FinancePage() {
  const bookQuery = useApiQuery(() => api.getPersonalFinanceBook() as Promise<BookPayload>, []);
  const journalsQuery = useApiQuery(() => api.listFinanceJournals(), []);
  const balancesQuery = useApiQuery(() => api.getPersonalFinanceBalances(), []);

  const [memo, setMemo] = useState('');
  const [amount, setAmount] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const accounts = bookQuery.data?.accounts ?? [];
  const assetAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === 'asset'),
    [accounts],
  );
  const incomeExpense = useMemo(
    () => accounts.filter((a) => a.account_type === 'income' || a.account_type === 'expense'),
    [accounts],
  );

  // Prefer checking debit + expense credit defaults once book loads
  const defaultDebit = debitAccountId || assetAccounts[0]?.id || '';
  const defaultCredit =
    creditAccountId ||
    incomeExpense.find((a) => a.account_type === 'expense')?.id ||
    incomeExpense[0]?.id ||
    '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!defaultDebit || !defaultCredit) {
      setFormError('Create or wait for default accounts first.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const draft = await api.createFinanceJournalDraft({
        eventDate: new Date().toISOString().slice(0, 10),
        memo,
        postings: [
          {
            accountId: defaultDebit,
            direction: 'debit',
            amount,
            currency: bookQuery.data?.book.base_currency ?? 'USD',
          },
          {
            accountId: defaultCredit,
            direction: 'credit',
            amount,
            currency: bookQuery.data?.book.base_currency ?? 'USD',
          },
        ],
      });
      const id = (draft as { id: string }).id;
      await api.postFinanceJournal(id);
      setMemo('');
      setAmount('');
      await Promise.all([journalsQuery.reload(), balancesQuery.reload()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to post journal');
    } finally {
      setPending(false);
    }
  }

  const loading = bookQuery.loading || journalsQuery.loading;
  const error = bookQuery.error || journalsQuery.error;
  const journals = (journalsQuery.data?.items ?? []) as Journal[];

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Personal finance"
        subtitle="Balanced personal ledger — draft/post journals from your real accounts."
        actions={
          <Link href="/finance/budgets" className="lifeos-btn-ghost text-sm">
            Budgets
          </Link>
        }
      />

      {loading ? <LoadingBlock /> : null}
      {error ? (
        <ErrorBlock
          error={error}
          onRetry={() => {
            void bookQuery.reload();
            void journalsQuery.reload();
            void balancesQuery.reload();
          }}
        />
      ) : null}

      {!loading && !error ? (
        <>
          <section className="lifeos-panel p-4">
            <h2 className="mb-3 font-display text-lg">Account balances</h2>
            {balancesQuery.data?.items?.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {(balancesQuery.data.items as Array<{ id: string; name: string; balance: string; currency: string; account_type: string }>).map(
                  (a) => (
                    <li
                      key={a.id}
                      className="flex items-baseline justify-between border-b border-slate-100 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium text-slate-900">{a.name}</span>
                        <span className="ml-2 text-xs uppercase text-slate-500">{a.account_type}</span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-800">
                        {a.balance} {a.currency}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <EmptyBlock title="No accounts" description="Your personal book will seed defaults on first use." />
            )}
          </section>

          <form onSubmit={onSubmit} className="lifeos-panel grid gap-3 p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Memo</label>
              <input className="lifeos-input" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Debit account (asset)</label>
              <select
                className="lifeos-input"
                value={defaultDebit}
                onChange={(e) => setDebitAccountId(e.target.value)}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.account_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Credit account</label>
              <select
                className="lifeos-input"
                value={defaultCredit}
                onChange={(e) => setCreditAccountId(e.target.value)}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.account_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Amount</label>
              <input
                className="lifeos-input font-mono tabular-nums"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="lifeos-btn-primary w-full" disabled={pending}>
                {pending ? 'Posting…' : 'Post balanced journal'}
              </button>
            </div>
            {formError ? (
              <p className="md:col-span-2 text-sm text-red-800" role="alert">
                {formError}
              </p>
            ) : null}
          </form>

          <section className="lifeos-panel overflow-x-auto p-4">
            <h2 className="mb-3 font-display text-lg">Recent journals</h2>
            {journals.length === 0 ? (
              <EmptyBlock title="No journals yet" description="Post a balanced entry to get started." />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Date</th>
                    <th>State</th>
                    <th>Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.map((j) => (
                    <tr key={j.id} className="border-t border-slate-100">
                      <td className="py-2 font-mono text-xs">{j.event_date}</td>
                      <td className="uppercase text-xs">{j.state}</td>
                      <td>{j.memo || j.payee || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
