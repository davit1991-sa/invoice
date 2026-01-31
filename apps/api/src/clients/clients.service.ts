import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, ImportCsvDto, UpdateClientDto } from './dto';
import { parseCsv, toCsv } from './csv';

const CLIENT_HEADERS = ['taxPayerId', 'name', 'address', 'email', 'phone', 'iban'];

function norm(v?: string | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const clients = await this.prisma.client.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate invoices for debt & counts
    const active = await this.prisma.invoice.groupBy({
      by: ['clientId'],
      where: {
        tenantId,
        clientId: { not: null },
        status: { in: [DocStatus.SENT, DocStatus.OVERDUE] },
      },
      _count: { _all: true },
      _sum: { amountGross: true },
    });

    const closed = await this.prisma.invoice.groupBy({
      by: ['clientId'],
      where: {
        tenantId,
        clientId: { not: null },
        status: DocStatus.PAID,
      },
      _count: { _all: true },
    });

    const activeMap = new Map<string, { count: number; sum: number }>();
    for (const a of active) {
      const id = a.clientId as string;
      activeMap.set(id, {
        count: a._count._all,
        sum: Number(String(a._sum.amountGross ?? 0)),
      });
    }
    const closedMap = new Map<string, number>();
    for (const c of closed) {
      closedMap.set(c.clientId as string, c._count._all);
    }

    return clients.map((c) => {
      const a = activeMap.get(c.id) || { count: 0, sum: 0 };
      const closedCount = closedMap.get(c.id) || 0;
      return {
        id: c.id,
        taxPayerId: c.taxPayerId,
        name: c.name,
        address: c.address,
        email: c.email,
        phone: c.phone,
        iban: c.iban,
        debt: a.sum,
        activeInvoicesNumber: a.count,
        closedInvoicesNumber: closedCount,
        currency: 'GEL',
        createdAt: c.createdAt,
      };
    });
  }

  async create(tenantId: string, dto: CreateClientDto) {
    if (!dto.taxPayerId?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('taxPayerId and name are required');
    }
    return this.prisma.client.create({
      data: {
        tenantId,
        taxPayerId: dto.taxPayerId.trim(),
        name: dto.name.trim(),
        address: norm(dto.address),
        email: norm(dto.email),
        phone: norm(dto.phone),
        iban: norm(dto.iban),
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateClientDto) {
    const existing = await this.prisma.client.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('CLIENT_NOT_FOUND');

    return this.prisma.client.update({
      where: { id },
      data: {
        taxPayerId: dto.taxPayerId ? dto.taxPayerId.trim() : undefined,
        name: dto.name ? dto.name.trim() : undefined,
        address: dto.address !== undefined ? norm(dto.address) : undefined,
        email: dto.email !== undefined ? norm(dto.email) : undefined,
        phone: dto.phone !== undefined ? norm(dto.phone) : undefined,
        iban: dto.iban !== undefined ? norm(dto.iban) : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.client.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('CLIENT_NOT_FOUND');
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }

  async exportCsv(tenantId: string) {
    const clients = await this.prisma.client.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    const rows = clients.map((c) => ({
      taxPayerId: c.taxPayerId,
      name: c.name,
      address: c.address ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      iban: c.iban ?? '',
    }));
    return toCsv(rows, CLIENT_HEADERS);
  }

  async importCsv(tenantId: string, dto: ImportCsvDto) {
    if (!dto.csv || !dto.csv.trim()) throw new BadRequestException('CSV_EMPTY');

    const rows = parseCsv(dto.csv);
    if (rows.length === 0) return { inserted: 0, updated: 0, skipped: 0 };

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const r of rows) {
      const taxPayerId = (r.taxPayerId || r.taxpayerid || r['Tax Payer ID'] || '').trim();
      const name = (r.name || r.Name || '').trim();
      if (!taxPayerId || !name) {
        skipped++;
        continue;
      }

      const data = {
        tenantId,
        taxPayerId,
        name,
        address: norm(r.address),
        email: norm(r.email),
        phone: norm(r.phone),
        iban: norm(r.iban),
      };

      if (dto.upsert) {
        const exists = await this.prisma.client.findUnique({
          where: { tenantId_taxPayerId: { tenantId, taxPayerId } },
        });
        if (exists) {
          await this.prisma.client.update({ where: { id: exists.id }, data });
          updated++;
        } else {
          await this.prisma.client.create({ data });
          inserted++;
        }
      } else {
        try {
          await this.prisma.client.create({ data });
          inserted++;
        } catch {
          skipped++;
        }
      }
    }

    return { inserted, updated, skipped };
  }
}
