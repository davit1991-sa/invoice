import { Body, Controller, Delete, Get, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto, ImportCsvDto, UpdateClientDto } from './dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService, private readonly subs: SubscriptionsService) {}

  @Get()
  async list(@CurrentTenant() user: { tenantId: string }) {
    return this.clients.list(user.tenantId);
  }

  @Post()
  async create(@CurrentTenant() user: { tenantId: string }, @Body() dto: CreateClientDto) {
    await this.subs.assertCanManageClients(user.tenantId);
    return this.clients.create(user.tenantId, dto);
  }

  @Put(':id')
  async update(
    @CurrentTenant() user: { tenantId: string },
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentTenant() user: { tenantId: string }, @Param('id') id: string) {
    return this.clients.remove(user.tenantId, id);
  }

  @Post('import/csv')
  async importCsv(@CurrentTenant() user: { tenantId: string }, @Body() dto: ImportCsvDto) {
    await this.subs.assertCanManageClients(user.tenantId);
    return this.clients.importCsv(user.tenantId, dto);
  }

  @Get('export/csv')
  async exportCsv(@CurrentTenant() user: { tenantId: string }, @Res() res: any) {
    const csv = await this.clients.exportCsv(user.tenantId);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="clients.csv"');
    res.send(csv);
  }
}
