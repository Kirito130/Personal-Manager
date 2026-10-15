import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        scopeType: z.enum(['PERSONAL', 'ORGANIZATION']),
        scopeId: z.string().uuid(),
        name: z.string().min(1),
        reportType: z.string().min(1),
        definition: z.record(z.unknown()).default({}),
      })
      .parse(body);
    return this.reports.createDefinition(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.getReport(user.id, id);
  }

  @Post(':id/exports')
  export(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.getReport(user.id, id);
  }
}
