import { PoolClient } from 'pg';

type OutboxEvent = {
  id: string;
  event_name: string;
  aggregate_id: string;
  scope_type: string;
  scope_id: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
};

export async function handleNotifications(client: PoolClient, event: OutboxEvent) {
  if (!event.actor_id) return;

  // Minimal: notify the actor for acknowledgement (real routing expands per event)
  const title =
    event.event_name === 'invoice.issued'
      ? 'Invoice issued'
      : event.event_name === 'timesheet.submitted'
        ? 'Timesheet submitted'
        : event.event_name === 'task.completed'
          ? 'Task completed'
          : 'LifeOS update';

  const notification = await client.query(
    `INSERT INTO platform.notifications
      (recipient_id, category, title, body, entity_type, entity_id, scope_type, scope_id, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     RETURNING id`,
    [
      event.actor_id,
      event.event_name.split('.')[0],
      title,
      '',
      event.event_name.split('.')[0],
      event.aggregate_id,
      event.scope_type,
      event.scope_id,
      JSON.stringify(event.payload ?? {}),
    ],
  );

  await client.query(
    `INSERT INTO platform.notification_receipts (notification_id, recipient_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [notification.rows[0].id, event.actor_id],
  );
}
