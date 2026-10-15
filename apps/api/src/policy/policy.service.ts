import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

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
}
