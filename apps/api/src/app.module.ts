import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { PolicyModule } from './policy/policy.module';
import { OutboxModule } from './outbox/outbox.module';
import { HealthModule } from './modules/health/health.module';
import { MeModule } from './modules/me/me.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { FocusModule } from './modules/focus/focus.module';
import { HomeModule } from './modules/home/home.module';
import { PersonalModule } from './modules/personal/personal.module';
import { PersonalFinanceModule } from './modules/personal-finance/personal-finance.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { CrmModule } from './modules/crm/crm.module';
import { BillingModule } from './modules/billing/billing.module';
import { CorrelationsModule } from './modules/correlations/correlations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AutomationModule } from './modules/automation/automation.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    DatabaseModule,
    PolicyModule,
    OutboxModule,
    HealthModule,
    MeModule,
    WorkspacesModule,
    TasksModule,
    CalendarModule,
    FocusModule,
    HomeModule,
    PersonalModule,
    PersonalFinanceModule,
    ProjectsModule,
    WorkforceModule,
    CrmModule,
    BillingModule,
    CorrelationsModule,
    NotificationsModule,
    KnowledgeModule,
    AutomationModule,
    ReportsModule,
  ],
})
export class AppModule {}
