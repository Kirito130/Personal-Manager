import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JournalDraftSchema } from '@lifeos/contracts';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { PersonalFinanceService } from './personal-finance.service';

@ApiTags('personal-finance')
@ApiBearerAuth()
@Controller('personal-finance')
export class PersonalFinanceController {
  constructor(private readonly finance: PersonalFinanceService) {}

  @Get('book')
  book(@CurrentUser() user: AuthUser) {
    return this.finance.getBook(user.id);
  }

  @Get('books/:bookId/balances')
  balances(@CurrentUser() user: AuthUser) {
    return this.finance.balances(user.id);
  }

  @Get('journals')
  journals(@CurrentUser() user: AuthUser) {
    return this.finance.listJournals(user.id);
  }

  @Post('journals/drafts')
  draft(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.finance.createDraft(user.id, JournalDraftSchema.parse(body));
  }

  @Post('journals/:id/post')
  post(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.finance.post(user.id, id);
  }

  @Post('journals/:id/reverse')
  reverse(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.finance.reverse(user.id, id);
  }

  @Get('budgets')
  budgets(@CurrentUser() user: AuthUser) {
    return this.finance.listBudgets(user.id);
  }

  @Post('budgets')
  createBudget(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z.object({ name: z.string().min(1), currency: z.string().length(3) }).parse(body);
    return this.finance.createBudget(user.id, dto.name, dto.currency);
  }
}
