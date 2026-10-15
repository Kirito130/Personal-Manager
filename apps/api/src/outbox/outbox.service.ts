import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { ScopeRef } from '@lifeos/shared';

@Injectable()
export class OutboxService {
  async enqueue(
    client: PoolClient,
    input: {
      eventName: string;
      aggregateId: string;
      aggregateVersion?: number;
      scope: ScopeRef;
      actorId: string | null;
      payload?: Record<string, unknown>;
      correlationId?: string;
    },
  ) {
    const id = randomUUID();
    const correlationId = input.correlationId ?? randomUUID();
    await client.query(
      `INSERT INTO platform.domain_events_outbox
        (id, event_name, aggregate_id, aggregate_version, scope_type, scope_id, actor_id, correlation_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        id,
        input.eventName,
        input.aggregateId,
        input.aggregateVersion ?? 1,
        input.scope.type,
        input.scope.id,
        input.actorId,
        correlationId,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    return { id, correlationId };
  }
}
