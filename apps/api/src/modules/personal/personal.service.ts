import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PolicyService } from '../../policy/policy.service';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class PersonalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly policy: PolicyService,
    private readonly outbox: OutboxService,
  ) {}

  async listLifeAreas(userId: string) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `SELECT * FROM personal.life_areas WHERE personal_space_id = $1 ORDER BY sort_order`,
      [spaceId],
    );
    return { items: result.rows };
  }

  async createLifeArea(userId: string, name: string) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `INSERT INTO personal.life_areas (personal_space_id, name) VALUES ($1,$2) RETURNING *`,
      [spaceId, name],
    );
    return result.rows[0];
  }

  async listGoals(userId: string) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `SELECT * FROM personal.goals WHERE scope_type = 'PERSONAL' AND scope_id = $1 ORDER BY created_at DESC`,
      [spaceId],
    );
    return { items: result.rows };
  }

  async createGoal(
    userId: string,
    input: {
      title: string;
      areaId?: string;
      target?: string;
      baseline?: string;
      dueOn?: string;
      rationale?: string;
    },
  ) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `INSERT INTO personal.goals
        (scope_type, scope_id, owner_id, area_id, title, target, baseline, due_on, rationale)
       VALUES ('PERSONAL',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        spaceId,
        userId,
        input.areaId ?? null,
        input.title,
        input.target ?? 100,
        input.baseline ?? 0,
        input.dueOn ?? null,
        input.rationale ?? '',
      ],
    );
    return result.rows[0];
  }

  async checkinGoal(userId: string, goalId: string, value: number, reflection = '') {
    const goal = await this.db.query(`SELECT * FROM personal.goals WHERE id = $1`, [goalId]);
    if (!goal.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Goal not found' });
    await this.policy.assertScopeAccess(userId, goal.rows[0].scope_type, goal.rows[0].scope_id);
    return this.db.withTransaction(async (client) => {
      const checkin = await client.query(
        `INSERT INTO personal.goal_checkins (goal_id, checkin_date, value, reflection, actor_id)
         VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
        [goalId, value, reflection, userId],
      );
      await client.query(`UPDATE personal.goals SET current_value = $2, version = version + 1 WHERE id = $1`, [
        goalId,
        value,
      ]);
      await this.outbox.enqueue(client, {
        eventName: 'goal.checkin_recorded',
        aggregateId: goalId,
        scope: { type: goal.rows[0].scope_type, id: goal.rows[0].scope_id },
        actorId: userId,
        payload: { value },
      });
      return checkin.rows[0];
    });
  }

  async listHabits(userId: string) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `SELECT * FROM personal.habits WHERE personal_space_id = $1 AND status = 'active'`,
      [spaceId],
    );
    return { items: result.rows };
  }

  async createHabit(userId: string, title: string, scheduleRule: string, targetCount: number) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `INSERT INTO personal.habits (personal_space_id, title, schedule_rule, target_count)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [spaceId, title, scheduleRule, targetCount],
    );
    return result.rows[0];
  }

  async checkinHabit(userId: string, habitId: string, localDate: string, count = 1) {
    const habit = await this.db.query(`SELECT * FROM personal.habits WHERE id = $1`, [habitId]);
    if (!habit.rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Habit not found' });
    await this.policy.assertPersonalScope(userId, habit.rows[0].personal_space_id);
    const result = await this.db.query(
      `INSERT INTO personal.habit_checkins (habit_id, local_date, count)
       VALUES ($1,$2,$3)
       ON CONFLICT (habit_id, local_date) DO UPDATE SET count = EXCLUDED.count
       RETURNING *`,
      [habitId, localDate, count],
    );
    return result.rows[0];
  }

  async upsertJournal(userId: string, localDate: string, body: string, mood?: string) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    return this.db.withTransaction(async (client) => {
      const upserted = await client.query(
        `INSERT INTO personal.journal_entries (personal_space_id, local_date, body, mood)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (personal_space_id, local_date)
         DO UPDATE SET body = EXCLUDED.body, mood = EXCLUDED.mood, version = personal.journal_entries.version + 1
         RETURNING *`,
        [spaceId, localDate, body, mood ?? null],
      );
      const entry = upserted.rows[0];
      await client.query(
        `INSERT INTO personal.journal_revisions (journal_entry_id, revision, body, author_id)
         VALUES ($1,$2,$3,$4)`,
        [entry.id, entry.version, body, userId],
      );
      return entry;
    });
  }

  async getJournal(userId: string, localDate: string) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `SELECT * FROM personal.journal_entries WHERE personal_space_id = $1 AND local_date = $2`,
      [spaceId, localDate],
    );
    return result.rows[0] ?? null;
  }

  async createNote(userId: string, title: string, body: string) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `INSERT INTO personal.notes (scope_type, scope_id, owner_id, title, body)
       VALUES ('PERSONAL',$1,$2,$3,$4) RETURNING *`,
      [spaceId, userId, title, body],
    );
    return result.rows[0];
  }

  async listNotes(userId: string) {
    const spaceId = await this.policy.getPersonalSpaceId(userId);
    const result = await this.db.query(
      `SELECT id, title, status, tags, version, updated_at FROM personal.notes
       WHERE scope_type = 'PERSONAL' AND scope_id = $1 ORDER BY updated_at DESC`,
      [spaceId],
    );
    return { items: result.rows };
  }
}
