import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    const dto = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        currency: z.string().length(3).optional(),
      })
      .parse(body);
    return this.workspaces.createOrganization(user.id, dto.name, dto.slug, dto.currency);
  }

  @Post(':id/invites')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id') organizationId: string,
    @Body() body: unknown,
  ) {
    const dto = z
      .object({
        email: z.string().email(),
        role: z.enum(['admin', 'project_manager', 'member', 'finance', 'viewer']).optional(),
      })
      .parse(body);
    return this.workspaces.invite(user.id, organizationId, dto.email, dto.role);
  }
}
