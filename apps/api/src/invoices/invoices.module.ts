import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { RevenueDocsGuard } from '../common/guards/revenue-docs.guard';

@Module({
  imports: [NotificationsModule, SubscriptionsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, RevenueDocsGuard],
})
export class InvoicesModule {}
