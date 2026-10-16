import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CorrelationRuleSchema } from '@lifeos/contracts';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { CorrelationsService } from './correlations.service';

@ApiTags('correlations')
@ApiBearerAuth()
@Controller('finance-correlations')
export class CorrelationsController {
  constructor(private readonly correlations: CorrelationsService) {}

  @Get('rules')
  rules(@CurrentUser() user: AuthUser) {
    return this.correlations.listRules(user.id);
  }

  @Post('rules')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.correlations.createRule(user.id, CorrelationRuleSchema.parse(body));
  }

  @Get('links')
  links(@CurrentUser() user: AuthUser) {
    return this.correlations.listLinks(user.id);
  }

  @Post('links/:id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.correlations.confirmDraft(user.id, id);
  }
}
