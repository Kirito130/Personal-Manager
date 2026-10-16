import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTaskSchema, UpdateTaskSchema } from '@lifeos/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('scopeType') scopeType: 'PERSONAL' | 'ORGANIZATION',
    @Query('scopeId') scopeId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.tasks.list(user.id, scopeType, scopeId, cursor);
  }

  @Get(':taskId')
  get(@CurrentUser() user: AuthUser, @Param('taskId') taskId: string) {
    return this.tasks.get(user.id, taskId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.tasks.create(user.id, CreateTaskSchema.parse(body));
  }

  @Patch(':taskId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.update(user.id, taskId, UpdateTaskSchema.parse(body));
  }

  @Post(':taskId/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    const dto = z.object({ version: z.number().int().positive() }).parse(body);
    return this.tasks.complete(user.id, taskId, dto.version);
  }

  @Post(':taskId/subtasks')
  subtask(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    const dto = z.object({ title: z.string().min(1) }).parse(body);
    return this.tasks.addSubtask(user.id, taskId, dto.title);
  }

  @Post(':taskId/checklist')
  checklist(
    @CurrentUser() user: AuthUser,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    const dto = z.object({ text: z.string().min(1) }).parse(body);
    return this.tasks.addChecklistItem(user.id, taskId, dto.text);
  }
}
