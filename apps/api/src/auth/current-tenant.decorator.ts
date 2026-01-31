import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentTenantUser = { tenantId: string };

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentTenantUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as CurrentTenantUser;
  },
);
