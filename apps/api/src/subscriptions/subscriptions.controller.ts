import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SubscriptionPlanCode } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { SubscriptionsService } from './subscriptions.service';

class MockActivateDto {
  planCode!: SubscriptionPlanCode;
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get('plans')
  plans() {
    return this.subs.listPlans();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentTenant() user: { tenantId: string }) {
    return this.subs.getMySubscription(user.tenantId);
  }

  /**
   * DEV/QA endpoint (disabled by default). Set ALLOW_MOCK_BILLING=true to enable.
   */
  @Post('mock/activate')
  @UseGuards(JwtAuthGuard)
  mockActivate(@CurrentTenant() user: { tenantId: string }, @Body() dto: MockActivateDto) {
    return this.subs.mockActivate(user.tenantId, dto.planCode);
  }
}
