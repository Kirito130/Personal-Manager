import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
  ) {}

  async createSpace(
    userId: string,
    scopeType: 'PERSONAL' | 'ORGANIZATION',
    scopeId: string,
    name: string,
  ) {
    await this.policy.assertScopeAccess(userId, scopeType, scopeId);
    const result = await this.db.query(
      `INSERT INTO collaboration.knowledge_spaces (scope_type, scope_id, name, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [scopeType, scopeId, name, userId],
    );
    return result.rows[0];
  }

  async listSpaces(userId: string, scopeType: 'PERSONAL' | 'ORGANIZATION', scopeId: string) {
    await this.policy.assertScopeAccess(userId, scopeType, scopeId);
    const result = await this.db.query(
      `SELECT * FROM collaboration.knowledge_spaces WHERE scope_type = $1 AND scope_id = $2`,
      [scopeType, scopeId],
    );
    return { items: result.rows };
  }

  async createArticle(userId: string, spaceId: string, title: string, body: string) {
    const space = await this.db.query(`SELECT * FROM collaboration.knowledge_spaces WHERE id = $1`, [
      spaceId,
    ]);
    if (!space.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Space not found' });
    await this.policy.assertScopeAccess(userId, space.rows[0].scope_type, space.rows[0].scope_id);
    return this.db.withTransaction(async (client) => {
      const article = await client.query(
        `INSERT INTO collaboration.articles (knowledge_space_id, title, body, owner_id, status)
         VALUES ($1,$2,$3,$4,'published') RETURNING *`,
        [spaceId, title, body, userId],
      );
      await client.query(
        `INSERT INTO collaboration.article_revisions (article_id, revision, title, body, author_id)
         VALUES ($1,1,$2,$3,$4)`,
        [article.rows[0].id, title, body, userId],
      );
      return article.rows[0];
    });
  }

  async listArticles(userId: string, spaceId: string) {
    const space = await this.db.query(`SELECT * FROM collaboration.knowledge_spaces WHERE id = $1`, [
      spaceId,
    ]);
    if (!space.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Space not found' });
    await this.policy.assertScopeAccess(userId, space.rows[0].scope_type, space.rows[0].scope_id);
    const result = await this.db.query(
      `SELECT id, title, status, version, updated_at FROM collaboration.articles
       WHERE knowledge_space_id = $1 ORDER BY updated_at DESC`,
      [spaceId],
    );
    return { items: result.rows };
  }
}
