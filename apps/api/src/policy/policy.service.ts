import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Application-layer authorization for the Nest domain API.
 * Required on every permissioned path: the DB pool bypasses RLS, so PolicyService
 * (plus resource-scoped SQL) is the real access-control boundary.
 */
@Injectable()
export class PolicyService {
  constructor(private readonly db: DatabaseService) {}

  async getPersonalSpaceId(userId: string): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM identity.personal_spaces WHERE owner_user_id = $1`,
      [userId],
    );
    if (!result.rows[0]) {
      throw new ForbiddenException({ code: 'NO_PERSONAL_SPACE', message: 'Personal space missing' });
    }
    return result.rows[0].id;
  }

  async assertPersonalScope(userId: string, scopeId: string): Promise<void> {
    const spaceId = await this.getPersonalSpaceId(userId);
    if (spaceId !== scopeId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your personal space' });
    }
  }

  async assertOrgMember(userId: string, organizationId: string): Promise<string> {
    const result = await this.db.query<{ role: string }>(
      `SELECT role FROM identity.memberships
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [organizationId, userId],
    );
    if (!result.rows[0]) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not an organization member' });
    }
    return result.rows[0].role;
  }

  async assertScopeAccess(
    userId: string,
    scopeType: 'PERSONAL' | 'ORGANIZATION',
    scopeId: string,
  ): Promise<void> {
    if (scopeType === 'PERSONAL') {
      await this.assertPersonalScope(userId, scopeId);
    } else {
      await this.assertOrgMember(userId, scopeId);
    }
  }

  async assertOrgRoles(
    userId: string,
    organizationId: string,
    roles: string[],
  ): Promise<void> {
    const role = await this.assertOrgMember(userId, organizationId);
    if (!roles.includes(role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient role' });
    }
  }

  /** Ensure finance accounts belong to the caller's personal book (IDOR guard). */
  async assertPersonalBookAccounts(bookId: string, accountIds: string[]): Promise<void> {
    const unique = [...new Set(accountIds)];
    if (unique.length === 0) return;
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM finance_personal.finance_accounts
       WHERE book_id = $1 AND id = ANY($2::uuid[])`,
      [bookId, unique],
    );
    if (result.rows.length !== unique.length) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Account not in your personal finance book',
      });
    }
  }

  async assertPersonalBookCategories(bookId: string, categoryIds: string[]): Promise<void> {
    const unique = [...new Set(categoryIds.filter(Boolean))];
    if (unique.length === 0) return;
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM finance_personal.finance_categories
       WHERE book_id = $1 AND id = ANY($2::uuid[])`,
      [bookId, unique],
    );
    if (result.rows.length !== unique.length) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Category not in your personal finance book',
      });
    }
  }
}
