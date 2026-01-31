import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TokenCache = {
  value: string;
  expiresAt: number; // epoch ms
};

export type TbcCreatePaymentResult = {
  payId: string;
  status: string;
  approvalUrl: string;
};

export type TbcPaymentDetails = {
  payId: string;
  status: string;
  currency?: string;
  amount?: number;
  raw: any;
};

function pickApprovalUrl(links: any[]): string | null {
  if (!Array.isArray(links)) return null;
  const item = links.find((l) => (l?.rel || '').toLowerCase() === 'approval_url');
  return item?.uri || null;
}

@Injectable()
export class TbcService {
  private token: TokenCache | null = null;

  constructor(private readonly config: ConfigService) {}

  private baseUrl() {
    return this.config.get<string>('TBC_TPAY_BASE_URL') || 'https://api.tbcbank.ge';
  }

  private apiKey() {
    const key = this.config.get<string>('TBC_API_KEY');
    if (!key) throw new HttpException({ code: 'TBC_API_KEY_MISSING' }, 500);
    return key;
  }

  private clientId() {
    const v = this.config.get<string>('TBC_CLIENT_ID');
    if (!v) throw new HttpException({ code: 'TBC_CLIENT_ID_MISSING' }, 500);
    return v;
  }

  private clientSecret() {
    const v = this.config.get<string>('TBC_CLIENT_SECRET');
    if (!v) throw new HttpException({ code: 'TBC_CLIENT_SECRET_MISSING' }, 500);
    return v;
  }

  private nowMs() {
    return Date.now();
  }

  private async fetchJson(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      throw new HttpException(
        {
          code: 'TBC_REQUEST_FAILED',
          status: res.status,
          url,
          response: json,
        },
        502,
      );
    }
    return json;
  }

  private async getAccessToken(): Promise<string> {
    const cached = this.token;
    if (cached && cached.expiresAt > this.nowMs()) return cached.value;

    // https://developers.tbcbank.ge/docs/checkout-get-checkout-access-token
    const url = `${this.baseUrl()}/v1/tpay/access-token`;
    const body = new URLSearchParams();
    body.set('client_id', this.clientId());
    body.set('client_secret', this.clientSecret());

    const json = await this.fetchJson(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: this.apiKey(),
      } as any,
      body,
    });

    const token = json?.access_token as string | undefined;
    const expiresIn = Number(json?.expires_in || 0);
    if (!token || !expiresIn) throw new HttpException({ code: 'TBC_BAD_TOKEN_RESPONSE', response: json }, 502);

    // subtract 60s to avoid edge expiry
    const expiresAt = this.nowMs() + Math.max(0, expiresIn - 60) * 1000;
    this.token = { value: token, expiresAt };
    return token;
  }

  async createPayment(args: {
    amountGEL: number;
    returnUrl: string;
    callbackUrl?: string;
    merchantPaymentId?: string;
    description?: string;
    userIpAddress?: string | null;
    language?: 'KA' | 'EN';
  }): Promise<TbcCreatePaymentResult> {
    // https://developers.tbcbank.ge/docs/checkout-create-checkout-payment
    const url = `${this.baseUrl()}/v1/tpay/payments`;
    const token = await this.getAccessToken();

    const total = Number(args.amountGEL.toFixed(2));
    const payload: any = {
      amount: {
        currency: 'GEL',
        total,
        subTotal: total,
        tax: 0,
        shipping: 0,
      },
      returnurl: args.returnUrl,
      callbackUrl: args.callbackUrl,
      userIpAddress: args.userIpAddress || undefined,
      preAuth: false,
      language: args.language || 'KA',
      merchantPaymentId: args.merchantPaymentId,
      description: args.description ? args.description.slice(0, 30) : undefined,
    };

    const json = await this.fetchJson(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: this.apiKey(),
      } as any,
      body: JSON.stringify(payload),
    });

    const payId = json?.payId as string | undefined;
    const status = json?.status as string | undefined;
    const approvalUrl = pickApprovalUrl(json?.links) || null;

    if (!payId || !approvalUrl || !status) {
      throw new HttpException({ code: 'TBC_BAD_CREATE_PAYMENT_RESPONSE', response: json }, 502);
    }

    return { payId, status, approvalUrl };
  }

  async getPaymentDetails(payId: string): Promise<TbcPaymentDetails> {
    // https://developers.tbcbank.ge/docs/checkout-get-checkout-payment-details
    const url = `${this.baseUrl()}/v1/tpay/payments/${encodeURIComponent(payId)}`;
    const token = await this.getAccessToken();

    const json = await this.fetchJson(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: this.apiKey(),
      } as any,
    });

    return {
      payId: json?.payId || payId,
      status: json?.status || 'Unknown',
      currency: json?.currency,
      amount: typeof json?.amount === 'number' ? json.amount : undefined,
      raw: json,
    };
  }
}
