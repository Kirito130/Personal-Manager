/**
 * LifeOS outbox worker — same Supabase Postgres as Nest API (ADR-0010).
 * System consumer: processes domain_events_outbox; not a second database.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { handleOwnerCompensation } from './handlers/owner-compensation';
import { handleNotifications } from './handlers/notifications';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required (single Supabase Postgres for Nest API/worker)');
}

const pool = new Pool({ connectionString });

const pollInterval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000);

async function processBatch() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const events = await client.query(
      `SELECT * FROM platform.domain_events_outbox
       WHERE published_at IS NULL
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 20`,
    );

    for (const event of events.rows) {
      try {
        const already = await client.query(
          `SELECT 1 FROM platform.event_inbox_dedup WHERE event_id = $1`,
          [event.id],
        );
        if (!already.rows[0]) {
          if (event.event_name === 'owner_compensation.recorded') {
            await handleOwnerCompensation(client, event);
          } else if (
            ['task.assigned', 'task.completed', 'invoice.issued', 'timesheet.submitted'].includes(
              event.event_name,
            )
          ) {
            await handleNotifications(client, event);
          }

          await client.query(
            `INSERT INTO platform.event_inbox_dedup (event_id, consumer)
             VALUES ($1, 'lifeos-worker')
             ON CONFLICT DO NOTHING`,
            [event.id],
          );
        }

        await client.query(
          `UPDATE platform.domain_events_outbox
           SET published_at = now(), attempts = attempts + 1, last_error = NULL
           WHERE id = $1`,
          [event.id],
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        await client.query(
          `UPDATE platform.domain_events_outbox
           SET attempts = attempts + 1, last_error = $2
           WHERE id = $1`,
          [event.id, message],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // eslint-disable-next-line no-console
    console.error('worker batch failed', err);
  } finally {
    client.release();
  }
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(`LifeOS worker started (poll ${pollInterval}ms) correlation=${randomUUID()}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await processBatch();
    await new Promise((r) => setTimeout(r, pollInterval));
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
