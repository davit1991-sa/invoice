import { Body, Controller, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshDto, RegisterDto, RequestOtpDto, VerifyOtpDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.auth.register(dto, req);
  }

  @Post('login/request-otp')
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: any) {
    return this.auth.requestOtp(dto, req);
  }

  @Post('login/verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    return this.auth.verifyOtp(dto, req);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto, @Req() req: any) {
    return this.auth.refresh(dto, req);
  }
}
