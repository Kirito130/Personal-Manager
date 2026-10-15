import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { MeService } from './me.service';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller()
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.me.getMe(user.id, user.email);
  }
}
