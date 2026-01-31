import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calcVat } from './vat';
import { generateInvoicePdf } from '../pdf/generate';
import { CreateInvoiceDto, ListInvoicesQuery, UpdateInvoiceDto } from './dto';

function norm(v?: string | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toDecimal(v: string | number): Prisma.Decimal {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException('INVALID_AMOUNT');
  // Keep 2 decimals
  const fixed = n.toFixed(2);
  return new Prisma.Decimal(fixed);
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListInvoicesQuery) {
    const where: Prisma.InvoiceWhereInput = { tenantId };

    if (query.status) where.status = query.status as any;

    if (query.q && query.q.trim()) {
      const q = query.q.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { purpose: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { client: { taxPayerId: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const items = await this.prisma.invoice.findMany({
      where,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      purpose: i.purpose,
      amountNet: String(i.amountNet),
      vatAmount: String(i.vatAmount),
      amountGross: String(i.amountGross),
      currency: i.currency,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      status: i.status,
      client: i.client
        ? {
            id: i.client.id,
            taxPayerId: i.client.taxPayerId,
            name: i.client.name,
            email: i.client.email,
            phone: i.client.phone,
            iban: i.client.iban,
          }
        : null,
    }));
  }

  async getOne(tenantId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { client: true },
    });
    if (!inv) throw new NotFoundException('INVOICE_NOT_FOUND');

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      purpose: inv.purpose,
      amountNet: String(inv.amountNet),
      vatAmount: String(inv.vatAmount),
      amountGross: String(inv.amountGross),
      currency: inv.currency,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      status: inv.status,
      client: inv.client
        ? {
            id: inv.client.id,
            taxPayerId: inv.client.taxPayerId,
            name: inv.client.name,
            address: inv.client.address,
            email: inv.client.email,
            phone: inv.client.phone,
            iban: inv.client.iban,
          }
        : null,
    };
  }

  async create(tenantId: string, dto: CreateInvoiceDto) {
    if (!dto.purpose?.trim()) throw new BadRequestException('PURPOSE_REQUIRED');
    if (!dto.dueDate) throw new BadRequestException('DUE_DATE_REQUIRED');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('TENANT_NOT_FOUND');

    // Resolve / upsert client
    let clientId: string | null = dto.clientId ? String(dto.clientId) : null;

    if (!clientId) {
      const tp = norm(dto.clientTaxPayerId);
      const nm = norm(dto.clientName);
      if (!tp || !nm) throw new BadRequestException('CLIENT_REQUIRED');

      const existing = await this.prisma.client.findUnique({
        where: { tenantId_taxPayerId: { tenantId, taxPayerId: tp } },
      });

      if (existing) {
        const updated = await this.prisma.client.update({
          where: { id: existing.id },
          data: {
            name: nm,
            address: norm(dto.clientAddress),
            email: norm(dto.clientEmail),
            phone: norm(dto.clientPhone),
            iban: norm(dto.clientIban),
          },
        });
        clientId = updated.id;
      } else {
        const created = await this.prisma.client.create({
          data: {
            tenantId,
            taxPayerId: tp,
            name: nm,
            address: norm(dto.clientAddress),
            email: norm(dto.clientEmail),
            phone: norm(dto.clientPhone),
            iban: norm(dto.clientIban),
          },
        });
        clientId = created.id;
      }
    } else {
      // validate belongs to tenant
      const c = await this.prisma.client.findFirst({ where: { id: clientId, tenantId } });
      if (!c) throw new BadRequestException('CLIENT_NOT_FOUND');
    }

    const amountNet = toDecimal(dto.amountNet);
    const includeVat = Boolean(dto.includeVat);

    const { vatAmount, amountGross } = calcVat({
      amountNet,
      includeVat,
      tenantIsVatPayer: tenant.isVatPayer,
    });

    const dueDate = new Date(dto.dueDate);
    if (Number.isNaN(dueDate.getTime())) throw new BadRequestException('INVALID_DUE_DATE');

    // Invoice numbering: <TenantRegNumber>-<ClientTaxPayerId>-<seq>
    // seq is 1..n per (tenant, client)
    const client = await this.prisma.client.findFirst({ where: { id: clientId!, tenantId } });
    if (!client) throw new BadRequestException('CLIENT_NOT_FOUND');

    const prefix = `${tenant.regNumber}-${client.taxPayerId}-`;

    // retry on rare unique race
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.invoice.count({
        where: { tenantId, invoiceNumber: { startsWith: prefix } },
      });
      const seq = count + 1;
      const invoiceNumber = `${prefix}${seq}`;

      try {
        const created = await this.prisma.invoice.create({
          data: {
            tenantId,
            clientId: clientId!,
            invoiceNumber,
            purpose: dto.purpose.trim(),
            amountNet,
            vatAmount,
            amountGross,
            dueDate,
            status: (dto.status as DocStatus) || DocStatus.DRAFT,
          },
          include: { client: true },
        });

        return {
          id: created.id,
          invoiceNumber: created.invoiceNumber,
          status: created.status,
        };
      } catch (e: any) {
        // Prisma unique constraint
        const msg = String(e?.message || '');
        if (msg.includes('Unique constraint') || msg.includes('P2002')) continue;
        throw e;
      }
    }

    throw new BadRequestException('INVOICE_NUMBER_GENERATION_FAILED');
  }

  async update(tenantId: string, id: string, dto: UpdateInvoiceDto) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, tenantId }, include: { tenant: true } });
    if (!inv) throw new NotFoundException('INVOICE_NOT_FOUND');

    let amountNet = inv.amountNet;
    let includeVat = dto.includeVat !== undefined ? Boolean(dto.includeVat) : null;

    if (dto.amountNet !== undefined) amountNet = toDecimal(dto.amountNet);

    const willIncludeVat = includeVat === null ? (inv.vatAmount.greaterThan(new Prisma.Decimal('0'))) : includeVat;

    const { vatAmount, amountGross } = calcVat({
      amountNet,
      includeVat: willIncludeVat,
      tenantIsVatPayer: inv.tenant.isVatPayer,
    });

    const data: Prisma.InvoiceUpdateInput = {
      purpose: dto.purpose ? dto.purpose.trim() : undefined,
      amountNet,
      vatAmount,
      amountGross,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: dto.status ? (dto.status as any) : undefined,
    };

    const updated = await this.prisma.invoice.update({ where: { id }, data });
    return { ok: true, id: updated.id };
  }


async pdf(tenantId: string, id: string) {
  const inv = await this.prisma.invoice.findFirst({
    where: { id, tenantId },
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

  return { buffer: buf, invoiceNumber: inv.invoiceNumber };
}

  async remove(tenantId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!inv) throw new NotFoundException('INVOICE_NOT_FOUND');
    await this.prisma.invoice.delete({ where: { id } });
    return { ok: true };
  }
}
