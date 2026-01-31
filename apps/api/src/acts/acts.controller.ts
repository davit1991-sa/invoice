import { FastifyReply, FastifyRequest } from 'fastify';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Res, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { ActsService } from './acts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateActDto, ListActsQuery, UpdateActDto } from './dto';
import { RevenueDocsGuard } from '../common/guards/revenue-docs.guard';

@Controller('acts')
@UseGuards(JwtAuthGuard)
export class ActsController {
  constructor(
    private readonly acts: ActsService,
    private readonly notifications: NotificationsService,
    private readonly subs: SubscriptionsService,
  ) {}

  @Get()
  async list(@CurrentTenant() user: { tenantId: string }, @Query() query: ListActsQuery) {
    return this.acts.list(user.tenantId, query || {});
  }

  @Get(':id')
  async getOne(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string) {
    return this.acts.getOne(user.tenantId, id);
  }


@Get(':id/pdf')
async pdf(
  @CurrentTenant() user: { tenantId: string },
  @Param('id') id: string,
  @Res({ passthrough: true }) res: FastifyReply
) {
  const out = await this.acts.pdf(user.tenantId, id);
  res.header('Content-Type', 'application/pdf');
  res.header('Content-Disposition', `attachment; filename="act-${out.actNumber}.pdf"`);
  return out.buffer;
}


@Post(':id/send/email')
async sendEmail(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string, @Body() body: { to?: string }) {
  return this.notifications.sendActEmail({ tenantId: user.tenantId, actId: id, toEmail: body?.to || null, createdIp: null });
}

@Post(':id/send/whatsapp')
async sendWhatsApp(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string, @Body() body: { to?: string }) {
  return this.notifications.sendActWhatsApp({ tenantId: user.tenantId, actId: id, toPhone: body?.to || null, createdIp: null });
}


  @Post()
  @UseGuards(RevenueDocsGuard)
  async create(
    @CurrentTenant() user: { tenantId: string },
    @Body() dto: CreateActDto,
    @Req() req: FastifyRequest,
  ) {
    await this.subs.reserveAct(user.tenantId, req.ip);
    return this.acts.create(user.tenantId, dto);
  }

  @Put(':id')
  async update(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string, @Body() dto: UpdateActDto) {
    return this.acts.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string) {
    return this.acts.remove(user.tenantId, id);
  }
}
