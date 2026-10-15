import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string) {
    const result = await this.db.query(
      `SELECT n.*, r.read_at, r.acknowledged_at
       FROM platform.notifications n
       LEFT JOIN platform.notification_receipts r
         ON r.notification_id = n.id AND r.recipient_id = $1
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [userId],
    );
    return { items: result.rows };
  }

  async markRead(userId: string, notificationId: string) {
    await this.db.query(
      `INSERT INTO platform.notification_receipts (notification_id, recipient_id, read_at)
       VALUES ($1,$2,now())
       ON CONFLICT (notification_id, recipient_id)
       DO UPDATE SET read_at = COALESCE(platform.notification_receipts.read_at, now())`,
      [notificationId, userId],
    );
    return { ok: true };
  }
}
