import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './admin.guard';
import { AdminLoginDto, AdminSubscriptionUpdateDto, AdminRevenueUpdateDto } from './dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('auth/login')
  async login(@Body() dto: AdminLoginDto) {
    return this.admin.login(dto.email, dto.password);
  }

  @UseGuards(AdminJwtGuard)
  @Get('tenants')
  async listTenants(@Query('q') q?: string) {
    return this.admin.listTenants(q);
  }

  @UseGuards(AdminJwtGuard)
  @Get('tenants/:tenantId/revenue/logs')
  async revenueLogs(@Param('tenantId') tenantId: string) {
    return this.admin.listRevenueLogs(tenantId);
  }

  @UseGuards(AdminJwtGuard)
  @Get('payments')
  async listPayments() {
    return this.admin.listPayments();
  }

  @UseGuards(AdminJwtGuard)
  @Post('tenants/:tenantId/subscription')
  async updateSubscription(@Param('tenantId') tenantId: string, @Body() dto: AdminSubscriptionUpdateDto) {
    return this.admin.updateSubscription(tenantId, dto);
  }

  @UseGuards(AdminJwtGuard)
  @Post('tenants/:tenantId/revenue')
  async updateRevenue(@Param('tenantId') tenantId: string, @Body() dto: AdminRevenueUpdateDto) {
    return this.admin.updateRevenueStatus(tenantId, dto);
  }

}
