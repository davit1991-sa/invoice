import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
import { sha256Hex, randomTokenBase64Url } from '../common/crypto';
import { generateInvoicePdf, generateActPdf } from '../pdf/generate';
import { ShareDocType } from '@prisma/client';

function publicBaseUrl() {
  // should point to API domain (Railway) or custom domain
  return process.env.PUBLIC_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3001';
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async createShareToken(params: {
    tenantId: string;
    docType: ShareDocType;
    docId: string;
    ttlHours?: number;
    createdIp?: string | null;
  }) {
    const ttlHours = params.ttlHours ?? 24 * 7; // 7 days
    const token = randomTokenBase64Url(32);
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

    await this.prisma.shareToken.create({
      data: {
        tenantId: params.tenantId,
        docType: params.docType,
        docId: params.docId,
        tokenHash,
        expiresAt,
        createdIp: params.createdIp || null,
      },
    });

    const url = `${publicBaseUrl()}/public/${params.docType === 'INVOICE' ? 'invoices' : 'acts'}/${token}/pdf`;
    return { token, url, expiresAt };
  }

  async resolveShareToken(token: string, docType: ShareDocType) {
    const tokenHash = sha256Hex(token);
    const rec = await this.prisma.shareToken.findFirst({
      where: {
        tokenHash,
        docType,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });
    if (!rec) throw new NotFoundException('SHARE_TOKEN_NOT_FOUND');

    // Mark used (one-time link). Comment this out if you want multi-use links.
    await this.prisma.shareToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });

    return rec;
  }

  async invoicePdfById(tenantId: string, invoiceId: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { tenant: true, client: true },
    });
    if (!inv) throw new NotFoundException('INVOICE_NOT_FOUND');

    const buf = await generateInvoicePdf({
      tenant: {
        regNumber: inv.tenant.regNumber,
        name: inv.tenant.name,
        legalAddress: inv.tenant.legalAddress,
        email: inv.tenant.email,
        phone: inv.tenant.phone,
        iban: inv.tenant.iban,
        isVatPayer: inv.tenant.isVatPayer,
      },
      client: inv.client
        ? {
            taxPayerId: inv.client.taxPayerId,
            name: inv.client.name,
            address: inv.client.address,
            email: inv.client.email,
            phone: inv.client.phone,
            iban: inv.client.iban,
          }
        : null,
      invoice: {
        invoiceNumber: inv.invoiceNumber,
        purpose: inv.purpose,
        amountNet: String(inv.amountNet),
        vatAmount: String(inv.vatAmount),
        amountGross: String(inv.amountGross),
        currency: inv.currency,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        status: inv.status,
      },
    });

    return { inv, buffer: buf };
  }

  async actPdfById(tenantId: string, actId: string) {
    const act = await this.prisma.compareAct.findFirst({
      where: { id: actId, tenantId },
      include: { tenant: true, client: true },
    });
    if (!act) throw new NotFoundException('ACT_NOT_FOUND');

    const buf = await generateActPdf({
      tenant: {
        regNumber: act.tenant.regNumber,
        name: act.tenant.name,
        legalAddress: act.tenant.legalAddress,
        email: act.tenant.email,
        phone: act.tenant.phone,
        iban: act.tenant.iban,
        isVatPayer: act.tenant.isVatPayer,
      },
      client: act.client
        ? {
            taxPayerId: act.client.taxPayerId,
            name: act.client.name,
            address: act.client.address,
            email: act.client.email,
            phone: act.client.phone,
            iban: act.client.iban,
          }
        : null,
      act: {
        actNumber: act.actNumber,
        purpose: act.purpose,
        amount: String(act.amount),
        currency: act.currency,
        issueDate: act.issueDate,
        dueDate: act.dueDate,
        status: act.status,
      },
    });

    return { act, buffer: buf };
  }

  async sendInvoiceEmail(params: { tenantId: string; invoiceId: string; toEmail?: string | null; createdIp?: string | null }) {
    const { inv, buffer } = await this.invoicePdfById(params.tenantId, params.invoiceId);

    const to = params.toEmail || inv.client?.email;
    if (!to) throw new BadRequestException('CLIENT_EMAIL_MISSING');

    const share = await this.createShareToken({
      tenantId: params.tenantId,
      docType: 'INVOICE',
      docId: inv.id,
      createdIp: params.createdIp || null,
    });

    const subject = `Invoice ${inv.invoiceNumber}`;
    const text = [
      `Hello,`,
      ``,
      `Please find attached Invoice ${inv.invoiceNumber}.`,
      `Purpose: ${inv.purpose}`,
      `Gross: ${inv.amountGross} ${inv.currency}`,
      `Due: ${inv.dueDate.toISOString().slice(0, 10)}`,
      ``,
      `Public link (one-time, expires ${share.expiresAt.toISOString()}):`,
      share.url,
      ``,
      `Best regards,`,
      inv.tenant.name,
    ].join('\n');

    await this.email.send({
      to,
      subject,
      text,
      attachments: [{ filename: `invoice-${inv.invoiceNumber}.pdf`, content: buffer, contentType: 'application/pdf' }],
    });

    // Mark status SENT (optional)
    await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: 'SENT' } });

    return { ok: true, to, link: share.url };
  }

  async sendInvoiceWhatsApp(params: { tenantId: string; invoiceId: string; toPhone?: string | null; createdIp?: string | null }) {
    const { inv } = await this.invoicePdfById(params.tenantId, params.invoiceId);

    const to = params.toPhone || inv.client?.phone;
    if (!to) throw new BadRequestException('CLIENT_PHONE_MISSING');

    const share = await this.createShareToken({
      tenantId: params.tenantId,
      docType: 'INVOICE',
      docId: inv.id,
      createdIp: params.createdIp || null,
    });

    const text = `Invoice ${inv.invoiceNumber}\nPurpose: ${inv.purpose}\nAmount: ${inv.amountGross} ${inv.currency}\nDue: ${inv.dueDate.toISOString().slice(0, 10)}\nDownload: ${share.url}`;

    await this.whatsapp.sendText({ toPhone: to, text });

    await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: 'SENT' } });

    return { ok: true, to, link: share.url };
  }

  async sendActEmail(params: { tenantId: string; actId: string; toEmail?: string | null; createdIp?: string | null }) {
    const { act, buffer } = await this.actPdfById(params.tenantId, params.actId);

    const to = params.toEmail || act.client?.email;
    if (!to) throw new BadRequestException('CLIENT_EMAIL_MISSING');

    const share = await this.createShareToken({
      tenantId: params.tenantId,
      docType: 'ACT',
      docId: act.id,
      createdIp: params.createdIp || null,
    });

    const subject = `ACT ${act.actNumber}`;
    const text = [
      `Hello,`,
      ``,
      `Please find attached ACT ${act.actNumber}.`,
      `Purpose: ${act.purpose}`,
      `Amount: ${act.amount} ${act.currency}`,
      `Due: ${act.dueDate.toISOString().slice(0, 10)}`,
      ``,
      `Public link (one-time, expires ${share.expiresAt.toISOString()}):`,
      share.url,
      ``,
      `Best regards,`,
      act.tenant.name,
    ].join('\n');

    await this.email.send({
      to,
      subject,
      text,
      attachments: [{ filename: `act-${act.actNumber}.pdf`, content: buffer, contentType: 'application/pdf' }],
    });

    await this.prisma.compareAct.update({ where: { id: act.id }, data: { status: 'SENT' } });

    return { ok: true, to, link: share.url };
  }

  async sendActWhatsApp(params: { tenantId: string; actId: string; toPhone?: string | null; createdIp?: string | null }) {
    const { act } = await this.actPdfById(params.tenantId, params.actId);

    const to = params.toPhone || act.client?.phone;
    if (!to) throw new BadRequestException('CLIENT_PHONE_MISSING');

    const share = await this.createShareToken({
      tenantId: params.tenantId,
      docType: 'ACT',
      docId: act.id,
      createdIp: params.createdIp || null,
    });

    const text = `ACT ${act.actNumber}\nPurpose: ${act.purpose}\nAmount: ${act.amount} ${act.currency}\nDue: ${act.dueDate.toISOString().slice(0, 10)}\nDownload: ${share.url}`;

    await this.whatsapp.sendText({ toPhone: to, text });

    await this.prisma.compareAct.update({ where: { id: act.id }, data: { status: 'SENT' } });

    return { ok: true, to, link: share.url };
  }
}
