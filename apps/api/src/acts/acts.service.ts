import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActDto, ListActsQuery, UpdateActDto } from './dto';
import { generateActPdf } from '../pdf/generate';

function norm(v?: string | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toDecimal(v: string | number): Prisma.Decimal {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException('INVALID_AMOUNT');
  const fixed = n.toFixed(2);
  return new Prisma.Decimal(fixed);
}

@Injectable()
export class ActsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListActsQuery) {
    const where: Prisma.CompareActWhereInput = { tenantId };

    if (query.status) where.status = query.status as any;

    if (query.q && query.q.trim()) {
      const q = query.q.trim();
      where.OR = [
        { actNumber: { contains: q, mode: 'insensitive' } },
        { purpose: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { client: { taxPayerId: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const items = await this.prisma.compareAct.findMany({
      where,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((a) => ({
      id: a.id,
      actNumber: a.actNumber,
      purpose: a.purpose,
      amount: String(a.amount),
      currency: a.currency,
      issueDate: a.issueDate,
      dueDate: a.dueDate,
      status: a.status,
      client: a.client
        ? {
            id: a.client.id,
            taxPayerId: a.client.taxPayerId,
            name: a.client.name,
            email: a.client.email,
            phone: a.client.phone,
            iban: a.client.iban,
          }
        : null,
    }));
  }

  async getOne(tenantId: string, id: string) {
    const act = await this.prisma.compareAct.findFirst({
      where: { id, tenantId },
      include: { client: true },
    });
    if (!act) throw new NotFoundException('ACT_NOT_FOUND');

    return {
      id: act.id,
      actNumber: act.actNumber,
      purpose: act.purpose,
      amount: String(act.amount),
      currency: act.currency,
      issueDate: act.issueDate,
      dueDate: act.dueDate,
      status: act.status,
      client: act.client
        ? {
            id: act.client.id,
            taxPayerId: act.client.taxPayerId,
            name: act.client.name,
            address: act.client.address,
            email: act.client.email,
            phone: act.client.phone,
            iban: act.client.iban,
          }
        : null,
    };
  }

  async create(tenantId: string, dto: CreateActDto) {
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
      const c = await this.prisma.client.findFirst({ where: { id: clientId, tenantId } });
      if (!c) throw new BadRequestException('CLIENT_NOT_FOUND');
    }

    const amount = toDecimal(dto.amount);

    const dueDate = new Date(dto.dueDate);
    if (Number.isNaN(dueDate.getTime())) throw new BadRequestException('INVALID_DUE_DATE');

    const client = await this.prisma.client.findFirst({ where: { id: clientId!, tenantId } });
    if (!client) throw new BadRequestException('CLIENT_NOT_FOUND');

    // Act numbering: <TenantTaxId>-<ClientTaxId>-ACT-<seq>
    const prefix = `${tenant.regNumber}-${client.taxPayerId}-ACT-`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.compareAct.count({
        where: { tenantId, actNumber: { startsWith: prefix } },
      });
      const seq = count + 1;
      const actNumber = `${prefix}${seq}`;

      try {
        const created = await this.prisma.compareAct.create({
          data: {
            tenantId,
            clientId: clientId!,
            actNumber,
            purpose: dto.purpose.trim(),
            amount,
            dueDate,
            status: (dto.status as DocStatus) || DocStatus.DRAFT,
          },
          include: { client: true },
        });

        return { id: created.id, actNumber: created.actNumber, status: created.status };
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.includes('Unique constraint') || msg.includes('P2002')) continue;
        throw e;
      }
    }

    throw new BadRequestException('ACT_NUMBER_GENERATION_FAILED');
  }

  async update(tenantId: string, id: string, dto: UpdateActDto) {
    const act = await this.prisma.compareAct.findFirst({ where: { id, tenantId } });
    if (!act) throw new NotFoundException('ACT_NOT_FOUND');

    const data: Prisma.CompareActUpdateInput = {
      purpose: dto.purpose ? dto.purpose.trim() : undefined,
      amount: dto.amount !== undefined ? toDecimal(dto.amount) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: dto.status ? (dto.status as any) : undefined,
    };

    const updated = await this.prisma.compareAct.update({ where: { id }, data });
    return { ok: true, id: updated.id };
  }


async pdf(tenantId: string, id: string) {
  const act = await this.prisma.compareAct.findFirst({
    where: { id, tenantId },
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

  return { buffer: buf, actNumber: act.actNumber };
}

  async remove(tenantId: string, id: string) {
    const act = await this.prisma.compareAct.findFirst({ where: { id, tenantId } });
    if (!act) throw new NotFoundException('ACT_NOT_FOUND');
    await this.prisma.compareAct.delete({ where: { id } });
    return { ok: true };
  }
}
