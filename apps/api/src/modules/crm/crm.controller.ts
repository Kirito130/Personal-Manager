import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { CrmService } from './crm.service';

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('accounts')
  accounts(@CurrentUser() user: AuthUser, @Query('organizationId') organizationId: string) {
    return this.crm.listAccounts(user.id, organizationId);
  }

  @Post('accounts')
  createAccount(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z.object({ organizationId: z.string().uuid(), name: z.string().min(1) }).parse(body);
    return this.crm.createAccount(user.id, dto.organizationId, dto.name);
  }

  @Get('opportunities')
  opportunities(@CurrentUser() user: AuthUser, @Query('organizationId') organizationId: string) {
    return this.crm.listOpportunities(user.id, organizationId);
  }

  @Post('opportunities')
  createOpportunity(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        organizationId: z.string().uuid(),
        accountId: z.string().uuid(),
        name: z.string().min(1),
        expectedValue: z.string().optional(),
        currency: z.string().length(3).optional(),
      })
      .parse(body);
    return this.crm.createOpportunity(user.id, dto.organizationId, dto);
  }

  @Post('opportunities/:id/convert')
  convert(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = z.object({ conversionKey: z.string().optional() }).parse(body ?? {});
    return this.crm.convertOpportunity(user.id, id, dto.conversionKey);
  }

  @Post('leads')
  createLead(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z.object({ organizationId: z.string().uuid(), title: z.string().min(1) }).parse(body);
    return this.crm.createLead(user.id, dto.organizationId, dto.title);
  }
}
