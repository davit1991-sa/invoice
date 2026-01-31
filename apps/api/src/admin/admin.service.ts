import { Injectable, HttpException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SubscriptionPlanCode, SubscriptionStatus, RevenueCheckStatus } from '@prisma/client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async ensureBootstrapAdmin() {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = (process.env.ADMIN_PASSWORD || '').trim();
    if (!email || !password) {
      this.logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set. Admin login disabled.');
      return;
    }

    const exists = await this.prisma.adminUser.findUnique({ where: { email } });
    if (exists) return;

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.adminUser.create({
      data: { email, passwordHash },
    });

    this.logger.log(`Bootstrap admin created: ${email}`);
  }

  async login(emailRaw: string, password: string) {
    const email = (emailRaw || '').trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin) throw new HttpException({ code: 'ADMIN_INVALID_CREDENTIALS' }, 401);

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new HttpException({ code: 'ADMIN_INVALID_CREDENTIALS' }, 401);

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync(
      { role: 'admin', email: admin.email },
      { secret: process.env.JWT_ACCESS_SECRET, subject: admin.id, expiresIn: process.env.JWT_ACCESS_TTL || '30m' },
    );

    return { accessToken };
  }

  async listTenants(q?: string) {
    const where: any = {};
    if (q && q.trim()) {
      const s = q.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { regNumber: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { subscription: true },
      take: 200,
    });

    return items.map((t) => ({
      id: t.id,
      regNumber: t.regNumber,
      name: t.name,
      email: t.email,
      phone: t.phone,
      isVatPayer: t.isVatPayer,
      createdAt: t.createdAt,
      subscription: t.subscription
        ? {
            planCode: t.subscription.planCode,
            status: t.subscription.status,
            validFrom: t.subscription.validFrom,
            validTo: t.subscription.validTo,
            invoicesUsed: t.subscription.invoicesUsed,
            actsUsed: t.subscription.actsUsed,
          }
        : null,
    }));
  }

  async listPayments() {
    const items = await this.prisma.paymentIntent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { tenant: { select: { name: true, regNumber: true, email: true } } },
    });

    return items.map((p) => ({
      id: p.id,
      tenant: p.tenant,
      provider: p.provider,
      planCode: p.planCode,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      payId: p.payId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }


  async listRevenueLogs(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new HttpException({ code: 'TENANT_NOT_FOUND' }, 404);

    const logs = await this.prisma.revenueVerificationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs.map((l) => ({
      id: l.id,
      tenantId: l.tenantId,
      status: l.status,
      name: l.name,
      note: l.note,
      adminId: l.adminId,
      createdAt: l.createdAt,
    }));
  }

  async updateSubscription(tenantId: string, dto: { action: 'set' | 'extend' | 'cancel'; planCode?: SubscriptionPlanCode; durationDays?: number; extendDays?: number }) {
    const now = new Date();

    if (dto.action === 'cancel') {
      const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });
      if (!existing) return { ok: true, action: 'cancel', existed: false };

      await this.prisma.subscription.update({
        where: { tenantId },
        data: { status: SubscriptionStatus.CANCELED, validTo: now },
      });
      return { ok: true, action: 'cancel', existed: true };
    }

    if (dto.action === 'extend') {
      const days = dto.extendDays || 0;
      if (days <= 0) throw new HttpException({ code: 'EXTEND_DAYS_REQUIRED' }, 400);

      const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });
      if (!existing) throw new HttpException({ code: 'SUBSCRIPTION_NOT_FOUND' }, 404);

      const base = existing.validTo > now ? existing.validTo : now;
      const validTo = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

      await this.prisma.subscription.update({
        where: { tenantId },
        data: { status: SubscriptionStatus.ACTIVE, validTo },
      });
      return { ok: true, action: 'extend', validTo };
    }

    // set/override
    const planCode = dto.planCode;
    if (!planCode) throw new HttpException({ code: 'PLAN_CODE_REQUIRED' }, 400);

    const plan = this.subscriptions.getPlanOrThrow(planCode);
    const days = dto.durationDays && dto.durationDays > 0 ? dto.durationDays : plan.durationDays;
    const validTo = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    await this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planCode,
        status: SubscriptionStatus.ACTIVE,
        validFrom: now,
        validTo,
        invoicesUsed: 0,
        actsUsed: 0,
      },
      update: {
        planCode,
        status: SubscriptionStatus.ACTIVE,
        validFrom: now,
        validTo,
        invoicesUsed: 0,
        actsUsed: 0,
      },
    });

    return { ok: true, action: 'set', planCode, validTo };
  }

  async updateRevenueStatus(tenantId: string, dto: { status: 'VERIFIED' | 'FAILED' | 'BYPASSED' | 'PENDING'; name?: string; note?: string }) {
    const status = dto.status as any;
    const name = dto.name?.trim() || null;
    const note = dto.note?.trim() || null;

    // Validate status enum
    const allowed: Record<string, boolean> = { VERIFIED: true, FAILED: true, BYPASSED: true, PENDING: true };
    if (!allowed[String(dto.status)]) throw new HttpException({ code: 'INVALID_REVENUE_STATUS' }, 400);

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new HttpException({ code: 'TENANT_NOT_FOUND' }, 404);

    const now = new Date();

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        revenueStatus: status as RevenueCheckStatus,
        revenueCheckedAt: now,
        revenueCheckedName: status === 'VERIFIED' ? (name || tenant.revenueCheckedName || tenant.name) : null,
        revenueCheckSource: 'admin_manual',
        revenueCheckError: status === 'FAILED' ? (note || 'ADMIN_MARKED_FAILED') : null,
        // keep tenant.name unchanged by default to avoid unexpected changes
      },
    });

    await this.prisma.revenueVerificationLog.create({
      data: {
        tenantId,
        status: status as RevenueCheckStatus,
        name,
        note,
        adminId: null,
      },
    });

    return { ok: true, tenantId, status, name, note };
  }

}
