import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicController } from './public.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PublicService } from './public.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
