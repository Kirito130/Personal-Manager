import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  const query = vi.fn();
  const db = { query } as never;
  let policy: PolicyService;

  beforeEach(() => {
    query.mockReset();
    policy = new PolicyService(db);
  });

  it('allows personal scope for the owner', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'space-1' }] });
    await expect(policy.assertPersonalScope('user-1', 'space-1')).resolves.toBeUndefined();
  });

  it('denies personal scope for another space', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'space-1' }] });
    await expect(policy.assertPersonalScope('user-1', 'space-other')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies org access without membership', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(policy.assertOrgMember('user-1', 'org-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies finance accounts outside the book', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'acct-1' }] });
    await expect(
      policy.assertPersonalBookAccounts('book-1', ['acct-1', 'acct-foreign']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
