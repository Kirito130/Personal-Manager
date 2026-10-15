import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { HomeService } from './home.service';

@ApiTags('home')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('home')
  homeView(
    @CurrentUser() user: AuthUser,
    @Query('scopeType') scopeType: 'PERSONAL' | 'ORGANIZATION',
    @Query('scopeId') scopeId: string,
    @Query('localDate') localDate: string,
  ) {
    return this.home.home(user.id, scopeType, scopeId, localDate);
  }

  @Get('today')
  today(
    @CurrentUser() user: AuthUser,
    @Query('scopeType') scopeType: 'PERSONAL' | 'ORGANIZATION',
    @Query('scopeId') scopeId: string,
    @Query('localDate') localDate: string,
  ) {
    return this.home.today(user.id, scopeType, scopeId, localDate);
  }

  @Get('search')
  search(
    @CurrentUser() user: AuthUser,
    @Query('q') q: string,
    @Query('scopeType') scopeType: 'PERSONAL' | 'ORGANIZATION',
    @Query('scopeId') scopeId: string,
  ) {
    return this.home.search(user.id, q ?? '', scopeType, scopeId);
  }
}
