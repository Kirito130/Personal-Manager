import { Module } from '@nestjs/common';
import { PersonalFinanceController } from './personal-finance.controller';
import { PersonalFinanceService } from './personal-finance.service';

@Module({
  controllers: [PersonalFinanceController],
  providers: [PersonalFinanceService],
  exports: [PersonalFinanceService],
})
export class PersonalFinanceModule {}
