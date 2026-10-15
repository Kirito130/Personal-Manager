'use client';

import { PageHeader } from '@/components/ui/page-header';
import { OrgRequiredEmpty } from '@/components/ui/org-required-empty';
import { useScope } from '@/context/scope-context';
import { api } from '@/lib/api';
import { todayLocalDate } from '@/lib/week-range';
import { FormEvent, useState } from 'react';

export default function ExpensesPage() {
  const { scope } = useScope();
  const orgId = scope?.type === 'ORGANIZATION' ? scope.id : null;
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isOwnerCompensation, setIsOwnerCompensation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setPending(true);
    setFormError(null);
    setMessage(null);
    try {
      await api.createBusinessExpense({
        organizationId: orgId,
        amount,
        currency: 'USD',
        expenseDate: todayLocalDate(),
        description: description || undefined,
        category: category || undefined,
        isOwnerCompensation,
      });
      setAmount('');
      setDescription('');
      setCategory('');
      setIsOwnerCompensation(false);
      setMessage('Expense recorded.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record expense');
    } finally {
      setPending(false);
    }
  }

  if (!orgId) return <OrgRequiredEmpty />;

  return (
    <>
      <PageHeader title="Expenses" subtitle="Business expenses and owner compensation flags." />
      <form onSubmit={onSubmit} className="lifeos-panel max-w-xl space-y-3 p-6">
        <div>
          <label htmlFor="exp-amount" className="mb-1 block text-sm font-medium text-slate-700">
            Amount (USD)
          </label>
          <input
            id="exp-amount"
            className="lifeos-input font-mono tabular-nums"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="exp-desc" className="mb-1 block text-sm font-medium text-slate-700">
            Description
          </label>
          <input
            id="exp-desc"
            className="lifeos-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="exp-cat" className="mb-1 block text-sm font-medium text-slate-700">
            Category
          </label>
          <input id="exp-cat" className="lifeos-input" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isOwnerCompensation}
            onChange={(e) => setIsOwnerCompensation(e.target.checked)}
          />
          Owner compensation
        </label>
        <button type="submit" className="lifeos-btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Submit expense'}
        </button>
        {message ? <p className="text-sm text-teal-800">{message}</p> : null}
        {formError ? (
          <p className="text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}
      </form>
    </>
  );
}
