import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpChannel, Prisma, Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateOtpCode, hashText, randomId, verifyHash } from '../common/crypto';
import { RefreshDto, RegisterDto, RequestOtpDto, VerifyOtpDto } from './dto';
import * as jwt from 'jsonwebtoken';
import { RevenueService } from '../revenue/revenue.service';

function getClientIp(req: any): string {
  // Fastify request has ip; fallback to headers
  return (
    req?.ip ||
    req?.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
    req?.headers?.['x-real-ip'] ||
    '0.0.0.0'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly jwtService: JwtService,
    private readonly revenue: RevenueService,
  ) {}

  private accessTtl(): string {
    return this.cfg.get<string>('JWT_ACCESS_TTL', '15m');
  }

  private refreshTtlSeconds(): number {
    const v = this.cfg.get<string>('JWT_REFRESH_TTL', '30d');
    // minimal parser: Nd | Nh | Nm | Ns
    const m = /^([0-9]+)([smhd])$/.exec(v);
    if (!m) return 30 * 24 * 3600;
    const n = Number(m[1]);
    const unit = m[2];
    const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return n * mult;
  }

  private otpTtlSeconds(): number {
    return Number(this.cfg.get<string>('OTP_TTL_SECONDS', '300'));
  }

  async register(dto: RegisterDto, req: any) {
    const verification = await this.revenue.assertOrBypassOnRegister(dto.accountType, dto.regNumber);

    const tenant = await this.prisma.tenant.create({
      data: {
        accountType: dto.accountType,
        regNumber: dto.regNumber,
        name: verification.name,
        legalAddress: dto.legalAddress,
        email: dto.email,
        phone: dto.phone,
        iban: dto.iban,
        isVatPayer: dto.isVatPayer,

        revenueStatus: verification.status,
        revenueCheckedAt: new Date(),
        revenueCheckedName: verification.status === 'VERIFIED' ? verification.name : null,
        revenueCheckSource: verification.source,
        revenueCheckError: verification.error,
      },
    });

    // Send OTP to email by default on registration
    await this.createAndSendOtp(
      { mode: 'email', identifier: dto.email },
      req,
      tenant.id,
    );

    return { tenantId: tenant.id, otpSent: true };
  }

  async requestOtp(dto: RequestOtpDto, req: any) {
    const tenant = await this.findTenantByIdentifier(dto);
    await this.createAndSendOtp(dto, req, tenant.id);
    return { ok: true };
  }

  async verifyOtp(dto: VerifyOtpDto, req: any) {
    const tenant = await this.findTenantByIdentifier(dto);

    const otp = await this.prisma.otpCode.findFirst({
      where: {
        identifier: dto.identifier,
        channel: dto.mode === 'email' ? OtpChannel.EMAIL : OtpChannel.WHATSAPP,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new UnauthorizedException('OTP_NOT_FOUND_OR_EXPIRED');

    const ok = await verifyHash(dto.code, otp.codeHash);
    if (!ok) throw new UnauthorizedException('OTP_INVALID');

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    const tokens = await this.issueTokens(tenant, getClientIp(req));
    return { tenant: this.toPublicTenant(tenant), ...tokens };
  }

  async refresh(dto: RefreshDto, req: any) {
    const secret = this.cfg.get<string>('JWT_REFRESH_SECRET', 'change_me_refresh_secret');

    let payload: any;
    try {
      payload = jwt.verify(dto.refreshToken, secret);
    } catch {
      throw new UnauthorizedException('REFRESH_INVALID');
    }

    if (!payload?.sub || !payload?.jti || payload?.typ !== 'refresh') {
      throw new UnauthorizedException('REFRESH_INVALID');
    }

    const rt = await this.prisma.refreshToken.findUnique({ where: { id: String(payload.jti) } });
    if (!rt || rt.revokedAt || rt.expiresAt <= new Date()) {
      throw new UnauthorizedException('REFRESH_REVOKED');
    }

    // Verify hash match (token binding)
    const matches = await verifyHash(dto.refreshToken, rt.tokenHash);
    if (!matches) throw new UnauthorizedException('REFRESH_MISMATCH');

    // rotate: revoke old and issue new
    await this.prisma.refreshToken.update({
      where: { id: rt.id },
      data: { revokedAt: new Date() },
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: String(payload.sub) } });
    if (!tenant) throw new UnauthorizedException('TENANT_NOT_FOUND');

    const tokens = await this.issueTokens(tenant, getClientIp(req));
    return { tenant: this.toPublicTenant(tenant), ...tokens };
  }

  // -----------------
  // Helpers
  // -----------------
  private toPublicTenant(t: Tenant) {
    return {
      id: t.id,
      name: t.name,
      regNumber: t.regNumber,
      email: t.email,
      phone: t.phone,
      iban: t.iban,
      isVatPayer: t.isVatPayer,
      accountType: t.accountType,
    };
  }

  private async findTenantByIdentifier(dto: RequestOtpDto | VerifyOtpDto): Promise<Tenant> {
    const where: Prisma.TenantWhereUniqueInput =
      dto.mode === 'email' ? { email: dto.identifier } : { phone: dto.identifier };

    const tenant = await this.prisma.tenant.findUnique({ where });
    if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');
    return tenant;
  }

  private async createAndSendOtp(dto: RequestOtpDto, req: any, tenantId?: string) {
    const code = generateOtpCode();
    const codeHash = await hashText(code);

    const ttl = this.otpTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const channel = dto.mode === 'email' ? OtpChannel.EMAIL : OtpChannel.WHATSAPP;

    await this.prisma.otpCode.create({
      data: {
        tenantId,
        identifier: dto.identifier,
        channel,
        codeHash,
        expiresAt,
        createdIp: getClientIp(req),
      },
    });

    // Provider abstraction placeholder: for now log only (mock)
    // In later batches we'll implement SMTP/Twilio/etc.
    // IMPORTANT: Do not log OTP in production.
    console.log(`[OTP][${channel}] identifier=${dto.identifier} code=${code} expiresIn=${ttl}s`);
  }

  private async issueTokens(tenant: Tenant, clientIp: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: tenant.id,
      typ: 'access',
    });

    const refreshId = randomId(16);
    const refreshSecret = this.cfg.get<string>('JWT_REFRESH_SECRET', 'change_me_refresh_secret');
    const refreshTtlSeconds = this.refreshTtlSeconds();

    const refreshToken = jwt.sign(
      {
        sub: tenant.id,
        jti: refreshId,
        typ: 'refresh',
      },
      refreshSecret,
      { expiresIn: refreshTtlSeconds },
    );

    const tokenHash = await hashText(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        id: refreshId,
        tenantId: tenant.id,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
        createdIp: clientIp,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTtl: this.accessTtl(),
      refreshTtlSeconds,
    };
  }
}
