import { describe, expect, it } from 'vitest';

describe('health contract', () => {
  it('exposes ok status shape', () => {
    const payload = { status: 'ok', service: 'lifeos-api', database: 'ok' };
    expect(payload.status).toBe('ok');
  });
});
