export type ScopeType = 'PERSONAL' | 'ORGANIZATION';

export type ScopeRef = {
  type: ScopeType;
  id: string;
};

export type Money = {
  amount: string;
  currency: string;
};

export function assertMoneyAmount(amount: string): void {
  if (!/^-?\d+(\.\d{1,6})?$/.test(amount)) {
    throw new Error('Invalid money amount');
  }
}

export function moneyAdd(a: string, b: string): string {
  const sum = (BigInt(toMinor(a)) + BigInt(toMinor(b))).toString();
  return fromMinor(sum);
}

function toMinor(value: string): string {
  const [whole, frac = ''] = value.split('.');
  const padded = (frac + '000000').slice(0, 6);
  const sign = whole.startsWith('-') ? '-' : '';
  const absWhole = whole.replace('-', '') || '0';
  return `${sign}${absWhole}${padded}`.replace(/^-?/, (m) => m);
}

function fromMinor(minor: string): string {
  const negative = minor.startsWith('-');
  const digits = minor.replace('-', '').padStart(7, '0');
  const whole = digits.slice(0, -6) || '0';
  const frac = digits.slice(-6).replace(/0+$/, '');
  const body = frac ? `${whole}.${frac}` : whole;
  return negative ? `-${body}` : body;
}

export type DomainEvent<TPayload = Record<string, unknown>> = {
  eventId: string;
  eventName: string;
  eventVersion: number;
  aggregateId: string;
  aggregateVersion: number;
  scope: ScopeRef;
  actorId: string | null;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
};

export const TASK_STATUS_CATEGORIES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
  'CANCELLED',
] as const;

export type TaskStatusCategory = (typeof TASK_STATUS_CATEGORIES)[number];
