import { Module } from '@nestjs/common';
import { CorrelationsController } from './correlations.controller';
import { CorrelationsService } from './correlations.service';

@Module({
  controllers: [CorrelationsController],
  providers: [CorrelationsService],
})
export class CorrelationsModule {}
