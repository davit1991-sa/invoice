import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: any = ctx.switchToHttp().getRequest();
    const auth = String(req?.headers?.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException('missing_token');

    try {
      const payload: any = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      if (!payload || payload.role !== 'admin' || !payload.sub) {
        throw new UnauthorizedException('invalid_admin_token');
      }

      req.admin = { adminId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('invalid_token');
    }
  }
}
