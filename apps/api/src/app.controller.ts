import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('/health')
  async health() {
    // DB ping - minimal readiness check
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, ts: new Date().toISOString() };
  }
}
