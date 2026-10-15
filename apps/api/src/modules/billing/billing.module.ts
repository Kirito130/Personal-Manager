import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { ExpensesController } from './expenses.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [BillingController, ExpensesController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
