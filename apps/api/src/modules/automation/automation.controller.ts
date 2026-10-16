import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { AutomationService } from './automation.service';

@ApiTags('automations')
@ApiBearerAuth()
@Controller('automations')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('scopeType') scopeType: 'PERSONAL' | 'ORGANIZATION',
    @Query('scopeId') scopeId: string,
  ) {
    return this.automation.list(user.id, scopeType, scopeId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        scopeType: z.enum(['PERSONAL', 'ORGANIZATION']),
        scopeId: z.string().uuid(),
        name: z.string().min(1),
        triggerEvent: z.string().min(1),
        condition: z.record(z.unknown()).optional(),
        action: z.record(z.unknown()),
      })
      .parse(body);
    return this.automation.create(user.id, dto);
  }

  @Get(':id/runs')
  runs(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.automation.listRuns(user.id, id);
  }
}
