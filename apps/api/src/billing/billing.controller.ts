import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { BillingService } from './billing.service';
import { TbcCheckoutDto, TbcCallbackDto } from './dto';

function getClientIp(req: any): string | null {
  const ip =
    req?.ip ||
    req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
    req?.headers?.['x-real-ip'];
  return ip || null;
}

function parseAllowedIps(): string[] {
  const raw = process.env.TBC_CALLBACK_ALLOWED_IPS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAllowedCallbackIp(ip: string | null): boolean {
  const allowed = parseAllowedIps();
  if (allowed.length === 0) return true; // allow all when not configured
  if (!ip) return false;
  return allowed.includes(ip);
}


@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('tbc/checkout')
  async startTbcCheckout(@CurrentTenant() user: { tenantId: string }, @Req() req: any, @Body() dto: TbcCheckoutDto) {
    return this.billing.startTbcCheckout(user.tenantId, dto.planCode, getClientIp(req));
  }

  /**
   * TBC callback: when payment reaches a final status, TBC sends:
   *   { "PaymentId": "<payId>" }
   * to callbackUrl.
   *
   * You MUST respond 200 quickly; then your server should query payment details by payId.
   */
  @Post('tbc/callback')
  async tbcCallback(@Req() req: any, @Body() dto: TbcCallbackDto) {
    const payId = dto?.PaymentId;
    if (!payId) return { ok: true, matched: false };

    const ip = getClientIp(req);
    if (!isAllowedCallbackIp(ip)) {
      // Return 200 to avoid retries, but ignore processing.
      return { ok: true, matched: false, ignored: true, reason: 'CALLBACK_IP_NOT_ALLOWED' };
    }
    return this.billing.handleTbcCallback(payId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('payments/:id')
  async getPayment(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string) {
    return this.billing.getPaymentIntent(user.tenantId, id);
  }
}
