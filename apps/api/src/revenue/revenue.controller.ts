import { Body, Controller, Post } from '@nestjs/common';
import { RevenueCheckDto } from './dto';
import { RevenueService } from './revenue.service';

@Controller('revenue')
export class RevenueController {
  constructor(private readonly revenue: RevenueService) {}

  /**
   * Note:
   * - my.gov.ge service does not expose an officially documented public API.
   * - In `manual` mode, response is PENDING with a manualUrl.
   * - In `mock` mode, response is VERIFIED with a deterministic mock name.
   */
  @Post('check')
  async check(@Body() dto: RevenueCheckDto) {
    return this.revenue.check(dto);
  }
}
