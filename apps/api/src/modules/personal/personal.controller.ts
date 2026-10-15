import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateGoalSchema, CreateHabitSchema } from '@lifeos/contracts';
import { z } from 'zod';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { PersonalService } from './personal.service';

@ApiTags('personal')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class PersonalController {
  constructor(private readonly personal: PersonalService) {}

  @Get('life-areas')
  lifeAreas(@CurrentUser() user: AuthUser) {
    return this.personal.listLifeAreas(user.id);
  }

  @Post('life-areas')
  createArea(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z.object({ name: z.string().min(1) }).parse(body);
    return this.personal.createLifeArea(user.id, dto.name);
  }

  @Get('goals')
  goals(@CurrentUser() user: AuthUser) {
    return this.personal.listGoals(user.id);
  }

  @Post('goals')
  createGoal(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.personal.createGoal(user.id, CreateGoalSchema.parse(body));
  }

  @Post('goals/:id/checkins')
  goalCheckin(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = z.object({ value: z.number(), reflection: z.string().optional() }).parse(body);
    return this.personal.checkinGoal(user.id, id, dto.value, dto.reflection);
  }

  @Get('habits')
  habits(@CurrentUser() user: AuthUser) {
    return this.personal.listHabits(user.id);
  }

  @Post('habits')
  createHabit(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = CreateHabitSchema.parse(body);
    return this.personal.createHabit(user.id, dto.title, dto.scheduleRule, dto.targetCount);
  }

  @Post('habits/:id/checkins')
  habitCheckin(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = z
      .object({ localDate: z.string(), count: z.number().int().min(0).optional() })
      .parse(body);
    return this.personal.checkinHabit(user.id, id, dto.localDate, dto.count);
  }

  @Get('journal/entries')
  getJournal(@CurrentUser() user: AuthUser, @Query('localDate') localDate: string) {
    return this.personal.getJournal(user.id, localDate);
  }

  @Post('journal/entries')
  upsertJournal(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({ localDate: z.string(), body: z.string(), mood: z.string().optional() })
      .parse(body);
    return this.personal.upsertJournal(user.id, dto.localDate, dto.body, dto.mood);
  }

  @Get('notes')
  notes(@CurrentUser() user: AuthUser) {
    return this.personal.listNotes(user.id);
  }

  @Post('notes')
  createNote(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z.object({ title: z.string().min(1), body: z.string().default('') }).parse(body);
    return this.personal.createNote(user.id, dto.title, dto.body);
  }
}
