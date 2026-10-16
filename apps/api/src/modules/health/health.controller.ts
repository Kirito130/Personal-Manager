import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { DatabaseService } from '../../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async health() {
    let database = 'ok';
    try {
      await this.db.query('SELECT 1');
    } catch {
      database = 'error';
    }
    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'lifeos-api',
      database,
      time: new Date().toISOString(),
    };
  }
}
