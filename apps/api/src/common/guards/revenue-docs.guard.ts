import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RevenueCheckStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Optional strict gating: block Invoice/Act creation until tenant is Revenue-verified.
 *
 * Enabled by env:
 * - REVENUE_DOCS_REQUIRE_VERIFIED=true
 *
 * Allowed statuses when enabled:
 * - VERIFIED
 * - BYPASSED (manual override)
 */
@Injectable()
export class RevenueDocsGuard implements CanActivate {
  private readonly defaultManualUrl = 'https://www.my.gov.ge/ka-ge/services/6/service/179?dark=';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requireVerified = String(this.cfg.get('REVENUE_DOCS_REQUIRE_VERIFIED', 'false')).toLowerCase() === 'true';
    if (!requireVerified) return true;

    const req = ctx.switchToHttp().getRequest();
    const tenantId = req?.user?.tenantId as string | undefined;
    if (!tenantId) return true; // JwtAuthGuard should prevent this

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, revenueStatus: true },
    });

    if (!tenant) return true;

    if (tenant.revenueStatus === RevenueCheckStatus.VERIFIED || tenant.revenueStatus === RevenueCheckStatus.BYPASSED) {
      return true;
    }

    const manualUrl = (this.cfg.get<string>('REVENUE_MANUAL_URL') || '').trim() || this.defaultManualUrl;
    throw new BadRequestException({
      code: 'REVENUE_NOT_VERIFIED',
      revenueStatus: tenant.revenueStatus,
      manualUrl,
    });
  }
}
