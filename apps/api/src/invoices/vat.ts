import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const VAT_RATE = new Prisma.Decimal('0.18');

export function calcVat(params: { amountNet: Prisma.Decimal; includeVat: boolean; tenantIsVatPayer: boolean }) {
  const { amountNet, includeVat, tenantIsVatPayer } = params;

  if (!includeVat) {
    return {
      vatAmount: new Prisma.Decimal('0'),
      amountGross: amountNet,
    };
  }

  if (!tenantIsVatPayer) {
    throw new BadRequestException('VAT_NOT_ALLOWED_FOR_NON_VAT_PAYER');
  }

  const vatAmount = amountNet.mul(VAT_RATE);
  const amountGross = amountNet.add(vatAmount);

  return { vatAmount, amountGross };
}
