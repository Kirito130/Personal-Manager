import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class MeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
  ) {}

  async getMe(userId: string, email: string) {
    const profile = await this.db.query(
      `SELECT id, email, display_name, locale, timezone, status
       FROM identity.profiles WHERE id = $1`,
      [userId],
    );

    let row = profile.rows[0];
    if (!row) {
      await this.db.query(
        `INSERT INTO identity.profiles (id, email, display_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [userId, email.toLowerCase(), email.split('@')[0]],
      );
      await this.db.query(
        `INSERT INTO identity.personal_spaces (owner_user_id)
         VALUES ($1)
         ON CONFLICT (owner_user_id) DO NOTHING`,
        [userId],
      );
      const again = await this.db.query(
        `SELECT id, email, display_name, locale, timezone, status
         FROM identity.profiles WHERE id = $1`,
        [userId],
      );
      row = again.rows[0];
    }

    const personalSpaceId = await this.policy.getPersonalSpaceId(userId);
    await this.db.query(`SELECT identity.ensure_personal_finance_book($1)`, [userId]);

    const memberships = await this.db.query(
      `SELECT m.organization_id, m.role, m.status, o.name, o.slug, o.base_currency
       FROM identity.memberships m
       JOIN identity.organizations o ON o.id = m.organization_id
       WHERE m.user_id = $1 AND m.status = 'active'`,
      [userId],
    );

    return {
      user: row,
      personalSpaceId,
      organizations: memberships.rows,
    };
  }
}
