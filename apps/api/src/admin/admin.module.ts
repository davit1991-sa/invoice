import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './admin.guard';

@Module({
  imports: [
    PrismaModule,
    SubscriptionsModule,
    JwtModule.register({}), // uses process.env.JWT_ACCESS_SECRET
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminJwtGuard],
})
export class AdminModule implements OnModuleInit {
  constructor(private readonly admin: AdminService) {}

  async onModuleInit() {
    await this.admin.ensureBootstrapAdmin();
  }
}
