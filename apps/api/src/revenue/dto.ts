import { AccountType } from '@prisma/client';

export type RevenueCheckDto = {
  accountType: AccountType;
  regNumber: string;
};

export type RevenueCheckResultDto = {
  status: 'VERIFIED' | 'PENDING' | 'FAILED';
  name?: string | null;
  source: 'mock' | 'manual';
  manualUrl?: string;
  errorCode?: string;
};
