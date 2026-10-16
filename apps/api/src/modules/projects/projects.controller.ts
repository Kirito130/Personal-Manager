import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateProjectSchema } from '@lifeos/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('projects')
  list(
    @CurrentUser() user: AuthUser,
    @Query('scopeType') scopeType: 'PERSONAL' | 'ORGANIZATION',
    @Query('scopeId') scopeId: string,
  ) {
    return this.projects.list(user.id, scopeType, scopeId);
  }

  @Post('projects')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.projects.create(user.id, CreateProjectSchema.parse(body));
  }

  @Get('projects/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.get(user.id, id);
  }

  @Get('projects/:id/timeline')
  timeline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.timeline(user.id, id);
  }

  @Post('projects/:id/milestones')
  milestone(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = z.object({ title: z.string().min(1), dueAt: z.string().optional() }).parse(body);
    return this.projects.addMilestone(user.id, id, dto.title, dto.dueAt);
  }

  @Get('boards/:boardId')
  board(@CurrentUser() user: AuthUser, @Param('boardId') boardId: string) {
    return this.projects.getBoard(user.id, boardId);
  }
}
