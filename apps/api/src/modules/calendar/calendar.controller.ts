import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateCalendarEventSchema, CreateTimeBlockSchema } from '@lifeos/contracts';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { CalendarService } from './calendar.service';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('events')
  listEvents(
    @CurrentUser() user: AuthUser,
    @Query('scopeType') scopeType: 'PERSONAL' | 'ORGANIZATION',
    @Query('scopeId') scopeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.calendar.listEvents(user.id, scopeType, scopeId, from, to);
  }

  @Post('events')
  createEvent(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = CreateCalendarEventSchema.parse(body);
    return this.calendar.createEvent(user.id, {
      scopeType: dto.scopeType,
      scopeId: dto.scopeId,
      title: dto.title,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      timezone: dto.timezone,
      allDay: dto.allDay,
      description: dto.description,
    });
  }

  @Post('time-blocks')
  createBlock(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = CreateTimeBlockSchema.parse(body);
    return this.calendar.createTimeBlock(user.id, {
      scopeType: dto.scopeType,
      scopeId: dto.scopeId,
      taskId: dto.taskId,
      title: dto.title,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      timezone: dto.timezone,
    });
  }

  @Get('time-blocks')
  listBlocks(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.calendar.listTimeBlocks(user.id, from, to);
  }
}
