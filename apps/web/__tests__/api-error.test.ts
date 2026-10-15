import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';

describe('ApiError', () => {
  it('carries status and message', () => {
    const err = new ApiError('Not found', 404, { code: 'NOT_FOUND' });
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ code: 'NOT_FOUND' });
  });
});
