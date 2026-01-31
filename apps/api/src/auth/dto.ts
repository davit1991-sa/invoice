import { AccountType } from '@prisma/client';

export type RegisterDto = {
  accountType: AccountType;
  regNumber: string;
  legalAddress: string;
  email: string;
  phone: string;
  iban: string;
  isVatPayer: boolean;
};

export type RequestOtpDto = {
  mode: 'email' | 'phone';
  identifier: string;
};

export type VerifyOtpDto = {
  mode: 'email' | 'phone';
  identifier: string;
  code: string;
};

export type RefreshDto = {
  refreshToken: string;
};
