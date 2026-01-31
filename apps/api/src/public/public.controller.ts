import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly pub: PublicService) {}

  @Get('invoices/:token/pdf')
  async invoicePdf(@Param('token') token: string, @Res({ passthrough: true }) res: FastifyReply) {
    const out = await this.pub.invoicePdfByToken(token);
    if (!out) throw new NotFoundException('PUBLIC_INVOICE_NOT_FOUND');
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="${out.filename}"`);
    return out.buffer;
  }

  @Get('acts/:token/pdf')
  async actPdf(@Param('token') token: string, @Res({ passthrough: true }) res: FastifyReply) {
    const out = await this.pub.actPdfByToken(token);
    if (!out) throw new NotFoundException('PUBLIC_ACT_NOT_FOUND');
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', `attachment; filename="${out.filename}"`);
    return out.buffer;
  }
}
