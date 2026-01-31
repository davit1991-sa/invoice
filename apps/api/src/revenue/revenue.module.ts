import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RevenueController } from './revenue.controller';
import { RevenueService } from './revenue.service';

@Module({
  imports: [PrismaModule],
  controllers: [RevenueController],
  providers: [RevenueService],
  exports: [RevenueService],
})
export class RevenueModule {}
