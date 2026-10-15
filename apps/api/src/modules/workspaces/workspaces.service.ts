import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
  ) {}

  async list(userId: string) {
    const personalSpaceId = await this.policy.getPersonalSpaceId(userId);
    const orgs = await this.db.query(
      `SELECT o.id, o.name, o.slug, o.base_currency, m.role
       FROM identity.memberships m
       JOIN identity.organizations o ON o.id = m.organization_id
       WHERE m.user_id = $1 AND m.status = 'active'`,
      [userId],
    );
    return {
      personal: { id: personalSpaceId, type: 'PERSONAL' },
      organizations: orgs.rows.map((o) => ({ ...o, type: 'ORGANIZATION' })),
    };
  }

  async createOrganization(userId: string, name: string, slug: string, currency = 'USD') {
    const result = await this.db.query<{ id: string }>(
      `SELECT identity.bootstrap_organization($1, $2, $3, $4) AS id`,
      [userId, name, slug, currency],
    );
    return { id: result.rows[0].id, name, slug };
  }

  async invite(userId: string, organizationId: string, email: string, role = 'member') {
    await this.policy.assertOrgRoles(userId, organizationId, ['owner', 'admin']);
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const inserted = await this.db.query(
      `INSERT INTO identity.workspace_invitations
        (organization_id, email, role, token_hash, invited_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, email, role, expires_at`,
      [organizationId, email.toLowerCase(), role, tokenHash, userId, expiresAt.toISOString()],
    );
    return { ...inserted.rows[0], inviteToken: token };
  }
}
