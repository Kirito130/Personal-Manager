import { describe, expect, it } from 'vitest';
import { assertMoneyAmount, moneyAdd } from './index';

describe('money helpers', () => {
  it('validates amounts', () => {
    expect(() => assertMoneyAmount('12.50')).not.toThrow();
    expect(() => assertMoneyAmount('abc')).toThrow();
  });

  it('adds without floating point', () => {
    expect(moneyAdd('10.10', '0.20')).toBe('10.3');
  });
});
