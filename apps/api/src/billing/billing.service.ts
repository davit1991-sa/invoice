import { Injectable, HttpException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus, SubscriptionPlanCode } from '@prisma/client';
import { TbcService } from './tbc.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tbc: TbcService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  private webBaseUrl() {
    const v = this.config.get<string>('WEB_BASE_URL');
    if (!v) throw new HttpException({ code: 'WEB_BASE_URL_MISSING' }, 500);
    return v.replace(/\/$/, '');
  }

  private callbackUrl() {
    const explicit = this.config.get<string>('TBC_CALLBACK_URL');
    if (explicit) return explicit;

    const apiBase = this.config.get<string>('API_BASE_URL');
    if (apiBase) return apiBase.replace(/\/$/, '') + '/billing/tbc/callback';

    // last resort (works locally)
    return 'http://localhost:3001/billing/tbc/callback';
  }

  async startTbcCheckout(tenantId: string, planCode: SubscriptionPlanCode, userIp: string | null) {
    const plan = this.subscriptions.getPlanOrThrow(planCode);
    const amountGEL = plan.priceGEL;

    const intent = await this.prisma.paymentIntent.create({
      data: {
        tenantId,
        provider: PaymentProvider.TBC,
        planCode,
        amount: amountGEL,
        currency: 'GEL',
        status: PaymentStatus.CREATED,
      },
    });

    const returnUrl = `${this.webBaseUrl()}/cabinet/subscription?checkout=return&intent=${encodeURIComponent(intent.id)}`;

    const res = await this.tbc.createPayment({
      amountGEL,
      returnUrl,
      callbackUrl: this.callbackUrl(),
      merchantPaymentId: intent.id,
      description: `Subscription ${planCode}`,
      userIpAddress: userIp,
      language: 'KA',
    });

    const updated = await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        payId: res.payId,
        approvalUrl: res.approvalUrl,
        status: PaymentStatus.REDIRECT_REQUIRED,
      },
    });

    return {
      paymentIntentId: updated.id,
      payId: updated.payId!,
      approvalUrl: updated.approvalUrl!,
    };
  }

  async handleTbcCallback(payId: string) {
    // Callback contains only PaymentId in body. We must query payment details.
    const intent = await this.prisma.paymentIntent.findFirst({
      where: { provider: PaymentProvider.TBC, payId },
    });

    // Always return 200 to TBC even if we can't match; merchant can inspect logs.
    if (!intent) {
      return { ok: true, matched: false };
    }

    const details = await this.tbc.getPaymentDetails(payId);
    const rawStatus = (details.status || '').toString();
    const status = rawStatus.replace(/\s+/g, '').toUpperCase();

    const mapStatus = (s: string): PaymentStatus => {
      switch (s) {
        case 'SUCCEEDED':
          return PaymentStatus.SUCCEEDED;
        case 'FAILED':
          return PaymentStatus.FAILED;
        case 'EXPIRED':
          return PaymentStatus.EXPIRED;
        case 'CANCELED':
        case 'CANCELLED':
          return PaymentStatus.CANCELED;
        case 'WAITINGCONFIRM':
        case 'WAITING_CONFIRM':
        case 'WAITINGFORCONFIRMATION':
          return PaymentStatus.WAITING_CONFIRM;
        case 'CREATED':
        case 'PROCESSING':
        case 'INPROCESS':
        case 'REDIRECTREQUIRED':
          return PaymentStatus.REDIRECT_REQUIRED;
        default:
          return PaymentStatus.CREATED;
      }
    };

    const mapped = mapStatus(status);

    this.logger.log(`TBC callback payId=${payId} status=${rawStatus} mapped=${mapped}`);
    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: mapped,
        lastCallback: details.raw,
      },
    });

    if (mapped === PaymentStatus.SUCCEEDED) {
      await this.subscriptions.activatePaidSubscription(intent.tenantId, intent.planCode);
    }

    return { ok: true, matched: true, status: mapped };
  }

  async getPaymentIntent(tenantId: string, id: string) {
    const pi = await this.prisma.paymentIntent.findFirst({ where: { id, tenantId } });
    if (!pi) throw new HttpException({ code: 'PAYMENT_NOT_FOUND' }, 404);
    return pi;
  }
}
