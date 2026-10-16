import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { MeService } from './me.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.me.getMe(user.id, user.email);
  }
}
