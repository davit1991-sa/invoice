import { FastifyReply, FastifyRequest } from 'fastify';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Res, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { InvoicesService } from './invoices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateInvoiceDto, ListInvoicesQuery, UpdateInvoiceDto } from './dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly notifications: NotificationsService,
    private readonly subs: SubscriptionsService,
  ) {}

  @Get()
  async list(@CurrentTenant() user: { tenantId: string }, @Query() query: ListInvoicesQuery) {
    return this.invoices.list(user.tenantId, query || {});
  }

  @Get(':id')
  async getOne(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string) {
    return this.invoices.getOne(user.tenantId, id);
  }


@Get(':id/pdf')
async pdf(
  @CurrentTenant() user: { tenantId: string },
  @Param('id') id: string,
  @Res({ passthrough: true }) res: FastifyReply
) {
  const out = await this.invoices.pdf(user.tenantId, id);
  res.header('Content-Type', 'application/pdf');
  res.header('Content-Disposition', `attachment; filename="invoice-${out.invoiceNumber}.pdf"`);
  return out.buffer;
}


@Post(':id/send/email')
async sendEmail(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string, @Body() body: { to?: string }) {
  // If body.to provided, overrides client email
  return this.notifications.sendInvoiceEmail({ tenantId: user.tenantId, invoiceId: id, toEmail: body?.to || null, createdIp: null });
}

@Post(':id/send/whatsapp')
async sendWhatsApp(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string, @Body() body: { to?: string }) {
  return this.notifications.sendInvoiceWhatsApp({ tenantId: user.tenantId, invoiceId: id, toPhone: body?.to || null, createdIp: null });
}


  @Post()
  async create(
    @CurrentTenant() user: { tenantId: string },
    @Body() dto: CreateInvoiceDto,
    @Req() req: FastifyRequest,
  ) {
    await this.subs.reserveInvoice(user.tenantId, req.ip);
    return this.invoices.create(user.tenantId, dto);
  }

  @Put(':id')
  async update(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string) {
    return this.invoices.remove(user.tenantId, id);
  }
}
