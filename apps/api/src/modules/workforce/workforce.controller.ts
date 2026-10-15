import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { WorkforceService } from './workforce.service';

@ApiTags('workforce')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class WorkforceController {
  constructor(private readonly workforce: WorkforceService) {}

  @Post('time-entries')
  timeEntry(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        organizationId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        taskId: z.string().uuid().optional(),
        startedAt: z.string().datetime(),
        endedAt: z.string().datetime(),
        description: z.string().optional(),
        billable: z.boolean().optional(),
      })
      .parse(body);
    return this.workforce.createTimeEntry(user.id, dto.organizationId, dto);
  }

  @Get('timesheets')
  listTimesheets(
    @CurrentUser() user: AuthUser,
    @Query('organizationId') organizationId: string,
  ) {
    return this.workforce.listTimesheets(user.id, organizationId);
  }

  @Post('timesheets')
  createTimesheet(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        organizationId: z.string().uuid(),
        periodStart: z.string(),
        periodEnd: z.string(),
      })
      .parse(body);
    return this.workforce.createTimesheet(
      user.id,
      dto.organizationId,
      dto.periodStart,
      dto.periodEnd,
    );
  }

  @Post('timesheets/:id/lines')
  attachLine(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = z.object({ timeEntryId: z.string().uuid() }).parse(body);
    return this.workforce.attachTimeEntryToTimesheet(user.id, id, dto.timeEntryId);
  }

  @Post('timesheets/:id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workforce.submitTimesheet(user.id, id);
  }

  @Post('timesheets/:id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = z
      .object({ decision: z.enum(['approved', 'rejected']), reason: z.string().optional() })
      .parse(body);
    return this.workforce.approveTimesheet(user.id, id, dto.decision, dto.reason);
  }

  @Post('attendance/check-in')
  checkIn(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z.object({ organizationId: z.string().uuid() }).parse(body);
    return this.workforce.checkIn(user.id, dto.organizationId);
  }

  @Post('attendance/check-out')
  checkOut(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z.object({ organizationId: z.string().uuid() }).parse(body);
    return this.workforce.checkOut(user.id, dto.organizationId);
  }

  @Get('capacity')
  capacity(
    @CurrentUser() user: AuthUser,
    @Query('organizationId') organizationId: string,
    @Query('week') week: string,
  ) {
    return this.workforce.capacity(user.id, organizationId, week);
  }
}
