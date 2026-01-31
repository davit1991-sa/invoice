import { SubscriptionPlanCode } from '@prisma/client';

export class AdminLoginDto {
  email!: string;
  password!: string;
}

export class AdminSubscriptionUpdateDto {
  action!: 'set' | 'extend' | 'cancel';
  planCode?: SubscriptionPlanCode;
  durationDays?: number; // for set (override duration)
  extendDays?: number; // for extend
}


export class AdminRevenueUpdateDto {
  status!: 'VERIFIED' | 'FAILED' | 'BYPASSED' | 'PENDING';
  name?: string;
  note?: string;
}
