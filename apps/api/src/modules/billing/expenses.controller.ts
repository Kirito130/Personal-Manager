import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { BillingService } from './billing.service';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('business-expenses')
export class ExpensesController {
  constructor(private readonly billing: BillingService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        organizationId: z.string().uuid(),
        amount: z.string(),
        currency: z.string().length(3),
        expenseDate: z.string(),
        category: z.string().optional(),
        description: z.string().optional(),
        projectId: z.string().uuid().optional(),
        isOwnerCompensation: z.boolean().optional(),
      })
      .parse(body);
    return this.billing.createExpense(user.id, dto.organizationId, dto);
  }
}
