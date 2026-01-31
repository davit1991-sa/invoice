import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlanCode, SubscriptionStatus } from '@prisma/client';

type PlanConfig = {
  code: SubscriptionPlanCode;
  title: string;
  priceGEL: number;
  durationDays: number;
  invoicesLimit: number | null; // null = unlimited
  actsLimit: number | null;     // null = unlimited
  allowClients: boolean;
};

const PLANS: Record<SubscriptionPlanCode, PlanConfig> = {
  [SubscriptionPlanCode.BASIC_NO_CLIENTS]: {
    code: SubscriptionPlanCode.BASIC_NO_CLIENTS,
    title: '1 month unlimited invoices & acts (no clients module)',
    priceGEL: 100,
    durationDays: 30,
    invoicesLimit: null,
    actsLimit: null,
    allowClients: false,
  },
  [SubscriptionPlanCode.PRO_UNLIMITED]: {
    code: SubscriptionPlanCode.PRO_UNLIMITED,
    title: '1 month unlimited clients, invoices & acts',
    priceGEL: 250,
    durationDays: 30,
    invoicesLimit: null,
    actsLimit: null,
    allowClients: true,
  },
  [SubscriptionPlanCode.PAYG_5_5]: {
    code: SubscriptionPlanCode.PAYG_5_5,
    title: '5 invoices + 5 acts (pay-as-you-go)',
    priceGEL: 20,
    durationDays: 30,
    invoicesLimit: 5,
    actsLimit: 5,
    allowClients: true,
  },
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  listPlans() {
    return Object.values(PLANS).map((p) => ({
      code: p.code,
      title: p.title,
      priceGEL: p.priceGEL,
      durationDays: p.durationDays,
      limits: {
        invoices: p.invoicesLimit,
        acts: p.actsLimit,
        allowClients: p.allowClients,
      },
    }));
  }

  /** Internal helper for billing module. */
  getPlanOrThrow(planCode: SubscriptionPlanCode): PlanConfig {
    const p = PLANS[planCode];
    if (!p) {
      throw new HttpException({ code: 'UNKNOWN_PLAN', planCode }, 400);
    }
    return p;
  }

  private now() {
    return new Date();
  }

  private ipHash(ip: string) {
    const salt = this.config.get<string>('IP_HASH_SALT') || 'dev-salt';
    return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
  }

  async getActiveSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return null;

    const now = this.now();
    if (sub.status !== SubscriptionStatus.ACTIVE) return null;
    if (sub.validTo.getTime() <= now.getTime()) return null;

    return sub;
  }

  async getMySubscription(tenantId: string) {
    const sub = await this.getActiveSubscription(tenantId);
    if (!sub) {
      return { active: false, subscription: null, plans: this.listPlans() };
    }

    const plan = PLANS[sub.planCode];
    const invoicesRemaining = plan.invoicesLimit == null ? null : Math.max(0, plan.invoicesLimit - sub.invoicesUsed);
    const actsRemaining = plan.actsLimit == null ? null : Math.max(0, plan.actsLimit - sub.actsUsed);

    return {
      active: true,
      subscription: {
        planCode: sub.planCode,
        status: sub.status,
        validFrom: sub.validFrom,
        validTo: sub.validTo,
        invoicesUsed: sub.invoicesUsed,
        actsUsed: sub.actsUsed,
        invoicesRemaining,
        actsRemaining,
        allowClients: plan.allowClients,
      },
      plans: this.listPlans(),
    };
  }

  private throw402(code: string, extra?: Record<string, any>) {
    throw new HttpException({ code, ...extra }, 402);
  }

  async assertCanManageClients(tenantId: string) {
    const sub = await this.getActiveSubscription(tenantId);
    if (!sub) this.throw402('SUBSCRIPTION_REQUIRED');

    const plan = PLANS[sub.planCode];
    if (!plan.allowClients) {
      throw new HttpException({ code: 'PLAN_DOES_NOT_ALLOW_CLIENTS', planCode: sub.planCode }, 403);
    }
    return true;
  }

  /**
   * Reserve (consume) 1 invoice capacity.
   * - If PAYG plan: increments invoicesUsed atomically if under limit.
   * - If no subscription: consumes free-trial invoice for this IP (only once per IP).
   */
  async reserveInvoice(tenantId: string, ip: string | null | undefined) {
    const sub = await this.getActiveSubscription(tenantId);
    const now = this.now();

    if (sub) {
      const plan = PLANS[sub.planCode];
      if (plan.invoicesLimit == null) return { mode: 'subscription' as const, planCode: sub.planCode };

      // PAYG reserve
      const updated = await this.prisma.subscription.updateMany({
        where: {
          tenantId,
          status: SubscriptionStatus.ACTIVE,
          validTo: { gt: now },
          invoicesUsed: { lt: plan.invoicesLimit },
        },
        data: { invoicesUsed: { increment: 1 } },
      });

      if (updated.count === 0) this.throw402('INVOICE_LIMIT_REACHED');
      return { mode: 'subscription' as const, planCode: sub.planCode };
    }

    // No subscription => free trial by IP
    if (!ip) this.throw402('IP_REQUIRED_FOR_FREE_TRIAL');
    const ipHash = this.ipHash(ip);

    const row = await this.prisma.freeTrialIP.findUnique({ where: { ipHash } });
    if (!row) {
      await this.prisma.freeTrialIP.create({
        data: { ipHash, invoiceUsedAt: now },
      });
      return { mode: 'free_trial' as const };
    }

    if (row.invoiceUsedAt) this.throw402('FREE_TRIAL_INVOICE_ALREADY_USED');

    await this.prisma.freeTrialIP.update({
      where: { ipHash },
      data: { invoiceUsedAt: now },
    });

    return { mode: 'free_trial' as const };
  }

  /** Reserve (consume) 1 act capacity. */
  async reserveAct(tenantId: string, ip: string | null | undefined) {
    const sub = await this.getActiveSubscription(tenantId);
    const now = this.now();

    if (sub) {
      const plan = PLANS[sub.planCode];
      if (plan.actsLimit == null) return { mode: 'subscription' as const, planCode: sub.planCode };

      const updated = await this.prisma.subscription.updateMany({
        where: {
          tenantId,
          status: SubscriptionStatus.ACTIVE,
          validTo: { gt: now },
          actsUsed: { lt: plan.actsLimit },
        },
        data: { actsUsed: { increment: 1 } },
      });

      if (updated.count === 0) this.throw402('ACT_LIMIT_REACHED');
      return { mode: 'subscription' as const, planCode: sub.planCode };
    }

    if (!ip) this.throw402('IP_REQUIRED_FOR_FREE_TRIAL');
    const ipHash = this.ipHash(ip);

    const row = await this.prisma.freeTrialIP.findUnique({ where: { ipHash } });
    if (!row) {
      await this.prisma.freeTrialIP.create({ data: { ipHash, actUsedAt: now } });
      return { mode: 'free_trial' as const };
    }

    if (row.actUsedAt) this.throw402('FREE_TRIAL_ACT_ALREADY_USED');

    await this.prisma.freeTrialIP.update({
      where: { ipHash },
      data: { actUsedAt: now },
    });

    return { mode: 'free_trial' as const };
  }

  /**
   * DEV/QA helper. In production you will activate subscriptions via TBC payment callbacks.
   */
  async mockActivate(tenantId: string, planCode: SubscriptionPlanCode) {
    const allow = (this.config.get<string>('ALLOW_MOCK_BILLING') || '').toLowerCase() === 'true';
    if (!allow) {
      throw new HttpException({ code: 'MOCK_BILLING_DISABLED' }, 403);
    }

    return this.activatePaidSubscription(tenantId, planCode);
  }

  /**
   * Production activation hook (used by payment callbacks).
   * Resets usage counters to 0 on each activation/renewal.
   */
  async activatePaidSubscription(tenantId: string, planCode: SubscriptionPlanCode) {
    const plan = this.getPlanOrThrow(planCode);
    const now = this.now();
    const validTo = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planCode,
        status: SubscriptionStatus.ACTIVE,
        validFrom: now,
        validTo,
        invoicesUsed: 0,
        actsUsed: 0,
        updatedAt: now,
      },
      update: {
        planCode,
        status: SubscriptionStatus.ACTIVE,
        validFrom: now,
        validTo,
        invoicesUsed: 0,
        actsUsed: 0,
        updatedAt: now,
      },
    });
  }


  /** Get plan config by code or throw (used by billing). */
  getPlanOrThrow(planCode: SubscriptionPlanCode): PlanConfig {
    const plan = PLANS[planCode];
    if (!plan) {
      throw new HttpException({ code: 'PLAN_NOT_FOUND', planCode }, 400);
    }
    return plan;
  }

  /**
   * Activate subscription after successful payment.
   * - Upserts tenant subscription to ACTIVE
   * - Resets usage counters
   */
  async activatePaidSubscription(tenantId: string, planCode: SubscriptionPlanCode) {
    const plan = this.getPlanOrThrow(planCode);
    const now = this.now();
    const validTo = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planCode,
        status: SubscriptionStatus.ACTIVE,
        validFrom: now,
        validTo,
        invoicesUsed: 0,
        actsUsed: 0,
        updatedAt: now,
      },
      update: {
        planCode,
        status: SubscriptionStatus.ACTIVE,
        validFrom: now,
        validTo,
        invoicesUsed: 0,
        actsUsed: 0,
        updatedAt: now,
      },
    });
  }

}
