import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule],
  providers: [EmailService, WhatsAppService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
