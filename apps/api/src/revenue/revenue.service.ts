import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountType, RevenueCheckStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueCheckDto, RevenueCheckResultDto } from './dto';

function normalizeRegNumber(s: string) {
  return (s || '').trim();
}

function requiresRevenueCheck(accountType: AccountType): boolean {
  // Spec: for first 3 cases we must check existence
  return accountType === 'PERSON' || accountType === 'LLC' || accountType === 'IE';
}

@Injectable()
export class RevenueService {
  private readonly manualUrl = 'https://www.my.gov.ge/ka-ge/services/6/service/179?dark=';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {}

  mode(): 'manual' | 'mock' {
    const v = (this.cfg.get<string>('REVENUE_CHECK_MODE', 'manual') || '').toLowerCase();
    return v === 'mock' ? 'mock' : 'manual';
  }

  allowBypass(): boolean {
    return String(this.cfg.get<string>('ALLOW_REVENUE_CHECK_BYPASS', 'true')).toLowerCase() === 'true';
  }

  getManualUrl(): string {
    return this.manualUrl;
  }

  async check(dto: RevenueCheckDto): Promise<RevenueCheckResultDto> {
    const accountType = dto.accountType;
    const regNumber = normalizeRegNumber(dto.regNumber);
    if (!regNumber) throw new BadRequestException('REG_NUMBER_REQUIRED');

    // Always cache + return for OTHER as pending (no hard requirement)
    if (!requiresRevenueCheck(accountType)) {
      await this.upsertCache(accountType, regNumber, null, 'PENDING', { reason: 'ACCOUNT_TYPE_OTHER' });
      return { status: 'PENDING', name: null, source: this.mode(), manualUrl: this.manualUrl };
    }

    // Check cache first (fresh window: 24h for demo)
    const cached = await this.prisma.revenueLookupCache.findUnique({
      where: { accountType_regNumber: { accountType, regNumber } },
    });
    if (cached) {
      // If VERIFIED/FAILED, return immediately. If PENDING, still return pending.
      if (cached.status === 'VERIFIED') {
        return { status: 'VERIFIED', name: cached.name, source: (cached.raw as any)?.source || this.mode() };
      }
      if (cached.status === 'FAILED') {
        return { status: 'FAILED', name: cached.name, source: (cached.raw as any)?.source || this.mode(), errorCode: 'NOT_FOUND' };
      }
    }

    const mode = this.mode();
    if (mode === 'mock') {
      const name = this.mockName(accountType, regNumber);
      await this.upsertCache(accountType, regNumber, name, 'VERIFIED', { source: 'mock' });
      return { status: 'VERIFIED', name, source: 'mock' };
    }

    // manual mode: do NOT attempt to scrape/automate my.gov.ge
    await this.upsertCache(accountType, regNumber, null, 'PENDING', { source: 'manual', manualUrl: this.manualUrl });
    return { status: 'PENDING', name: null, source: 'manual', manualUrl: this.manualUrl, errorCode: 'MANUAL_REQUIRED' };
  }

  async assertOrBypassOnRegister(accountType: AccountType, regNumber: string) {
    if (!requiresRevenueCheck(accountType)) {
      return {
        status: RevenueCheckStatus.PENDING,
        name: `UNVERIFIED_${regNumber}`,
        source: 'manual',
        error: null as string | null,
      };
    }

    const result = await this.check({ accountType, regNumber });

    if (result.status === 'VERIFIED' && result.name) {
      return {
        status: RevenueCheckStatus.VERIFIED,
        name: result.name,
        source: result.source,
        error: null as string | null,
      };
    }

    if (this.allowBypass()) {
      return {
        status: RevenueCheckStatus.BYPASSED,
        name: `UNVERIFIED_${regNumber}`,
        source: result.source,
        error: result.errorCode || null,
      };
    }

    // strict mode: block registration until verified
    throw new BadRequestException({
      code: 'REVENUE_VERIFICATION_REQUIRED',
      manualUrl: result.manualUrl || this.manualUrl,
    });
  }

  private mockName(accountType: AccountType, regNumber: string) {
    const prefix = accountType === 'PERSON' ? 'Mock Person' : accountType === 'LLC' ? 'Mock LLC' : 'Mock IE';
    return `${prefix} ${regNumber}`;
  }

  private async upsertCache(
    accountType: AccountType,
    regNumber: string,
    name: string | null,
    status: RevenueCheckStatus,
    raw: any,
  ) {
    await this.prisma.revenueLookupCache.upsert({
      where: { accountType_regNumber: { accountType, regNumber } },
      create: {
        accountType,
        regNumber,
        name,
        status,
        raw,
      },
      update: {
        name,
        status,
        raw,
        checkedAt: new Date(),
      },
    });
  }
}

export const RevenueRules = {
  requiresRevenueCheck,
};
