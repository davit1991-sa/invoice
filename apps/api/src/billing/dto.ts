import { IsEnum } from 'class-validator';
import { SubscriptionPlanCode } from '@prisma/client';

export class TbcCheckoutDto {
  @IsEnum(SubscriptionPlanCode)
  planCode!: SubscriptionPlanCode;
}

export class TbcCallbackDto {
  PaymentId!: string;
}
