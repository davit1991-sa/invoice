import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentTenant } from './current-tenant.decorator';

@Controller()
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async me(@CurrentTenant() user: { tenantId: string }) {
    const t = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      regNumber: t.regNumber,
      legalAddress: t.legalAddress,
      email: t.email,
      phone: t.phone,
      iban: t.iban,
      isVatPayer: t.isVatPayer,
      accountType: t.accountType,
    };
  }
}
