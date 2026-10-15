import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { FocusService } from './focus.service';

@ApiTags('focus')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('focus-sessions')
export class FocusController {
  constructor(private readonly focus: FocusService) {}

  @Get('active')
  active(@CurrentUser() user: AuthUser) {
    return this.focus.active(user.id);
  }

  @Post()
  start(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z.object({ taskId: z.string().uuid().optional() }).parse(body ?? {});
    return this.focus.start(user.id, dto.taskId);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.focus.pause(user.id, id);
  }

  @Post(':id/resume')
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.focus.resume(user.id, id);
  }

  @Post(':id/finish')
  finish(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = z.object({ pausedSeconds: z.number().int().min(0).optional() }).parse(body ?? {});
    return this.focus.finish(user.id, id, dto.pausedSeconds);
  }
}
