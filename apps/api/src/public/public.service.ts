import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async invoicePdfByToken(token: string) {
    const rec = await this.notifications.resolveShareToken(token, 'INVOICE');
    const inv = await this.prisma.invoice.findFirst({
      where: { id: rec.docId, tenantId: rec.tenantId },
      include: { tenant: true, client: true },
    });
    if (!inv) return null;
    const out = await this.notifications.invoicePdfById(rec.tenantId, inv.id);
    return { filename: `invoice-${out.inv.invoiceNumber}.pdf`, buffer: out.buffer };
  }

  async actPdfByToken(token: string) {
    const rec = await this.notifications.resolveShareToken(token, 'ACT');
    const act = await this.prisma.compareAct.findFirst({
      where: { id: rec.docId, tenantId: rec.tenantId },
      include: { tenant: true, client: true },
    });
    if (!act) return null;
    const out = await this.notifications.actPdfById(rec.tenantId, act.id);
    return { filename: `act-${out.act.actNumber}.pdf`, buffer: out.buffer };
  }
}
