import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateInvoiceSchema } from '@lifeos/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { BillingService } from './billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('quotes')
  listQuotes(@CurrentUser() user: AuthUser, @Query('organizationId') organizationId: string) {
    return this.billing.listQuotes(user.id, organizationId);
  }

  @Post('quotes')
  createQuote(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        organizationId: z.string().uuid(),
        accountId: z.string().uuid(),
        currency: z.string().length(3),
        validUntil: z.string().optional(),
        notes: z.string().optional(),
        lines: z
          .array(
            z.object({
              description: z.string().min(1),
              quantity: z.string(),
              unitPrice: z.string(),
              taxPct: z.number().optional(),
            }),
          )
          .min(1),
      })
      .parse(body);
    return this.billing.createQuote(user.id, dto.organizationId, dto);
  }

  @Post('quotes/:id/accept')
  acceptQuote(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.acceptQuote(user.id, id);
  }

  @Get('invoices')
  list(@CurrentUser() user: AuthUser, @Query('organizationId') organizationId: string) {
    return this.billing.listInvoices(user.id, organizationId);
  }

  @Post('invoices')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = CreateInvoiceSchema.extend({ organizationId: z.string().uuid() }).parse(body);
    return this.billing.createInvoice(user.id, dto.organizationId, dto);
  }

  @Post('invoices/:id/issue')
  issue(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.issueInvoice(user.id, id);
  }

  @Post('payments')
  payment(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        organizationId: z.string().uuid(),
        accountId: z.string().uuid(),
        amount: z.string(),
        currency: z.string().length(3),
        receivedOn: z.string(),
        idempotencyKey: z.string().min(1),
        reference: z.string().optional(),
      })
      .parse(body);
    return this.billing.recordPayment(user.id, dto.organizationId, dto);
  }

  @Post('payments/:id/allocate')
  allocate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = z.object({ invoiceId: z.string().uuid(), amount: z.string() }).parse(body);
    return this.billing.allocatePayment(user.id, id, dto.invoiceId, dto.amount);
  }
}
