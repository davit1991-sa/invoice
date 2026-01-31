import { Controller, Get, UseGuards } from '@nestjs/common';
import { DocStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/current-tenant.decorator';

function asNumberDecimal(v: any): number {
  if (v == null) return 0;
  // Prisma Decimal serializes differently depending on runtime
  const s = String(v);
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cabinet stats required by spec:
   * - Sent invoices total number
   * - Sent acts total number
   * - Paid invoices number + sum
   * - Pending invoices number + sum
   *
   * Assumptions:
   * - "Sent" = status in SENT/PAID/OVERDUE (excludes DRAFT/CANCELED)
   * - "Pending" = status in SENT/OVERDUE (excludes DRAFT/PAID/CANCELED)
   */
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async stats(@CurrentTenant() user: { tenantId: string }) {
    const tenantId = user.tenantId;

    const sentInvoiceWhere: Prisma.InvoiceWhereInput = {
      tenantId,
      status: { in: [DocStatus.SENT, DocStatus.PAID, DocStatus.OVERDUE] },
    };
    const pendingInvoiceWhere: Prisma.InvoiceWhereInput = {
      tenantId,
      status: { in: [DocStatus.SENT, DocStatus.OVERDUE] },
    };
    const paidInvoiceWhere: Prisma.InvoiceWhereInput = {
      tenantId,
      status: DocStatus.PAID,
    };

    const [sentInvoices, sentActs, paidAgg, pendingAgg] = await Promise.all([
      this.prisma.invoice.count({ where: sentInvoiceWhere }),
      this.prisma.compareAct.count({
        where: {
          tenantId,
          status: { in: [DocStatus.SENT, DocStatus.PAID, DocStatus.OVERDUE] },
        },
      }),
      this.prisma.invoice.aggregate({
        where: paidInvoiceWhere,
        _count: { _all: true },
        _sum: { amountGross: true },
      }),
      this.prisma.invoice.aggregate({
        where: pendingInvoiceWhere,
        _count: { _all: true },
        _sum: { amountGross: true },
      }),
    ]);

    const paidSum = asNumberDecimal(paidAgg._sum.amountGross);
    const pendingSum = asNumberDecimal(pendingAgg._sum.amountGross);

    return {
      sentInvoices,
      sentActs,
      paidInvoices: {
        count: paidAgg._count._all,
        sum: paidSum,
        currency: 'GEL',
      },
      pendingInvoices: {
        count: pendingAgg._count._all,
        sum: pendingSum,
        currency: 'GEL',
      },
    };
  }
}
