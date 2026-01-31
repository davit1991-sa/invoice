import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ActsController } from './acts.controller';
import { ActsService } from './acts.service';

@Module({
  imports: [NotificationsModule, SubscriptionsModule],
  controllers: [ActsController],
  providers: [ActsService],
})
export class ActsModule {}
