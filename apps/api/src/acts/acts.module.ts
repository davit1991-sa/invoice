import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ActsController } from './acts.controller';
import { ActsService } from './acts.service';
import { RevenueDocsGuard } from '../common/guards/revenue-docs.guard';

@Module({
  imports: [NotificationsModule, SubscriptionsModule],
  controllers: [ActsController],
  providers: [ActsService, RevenueDocsGuard],
})
export class ActsModule {}
