import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

interface AccessPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AccessPayload): Promise<{
    id: string;
    role: UserRole;
    phone: string;
    name: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, phone: true, name: true, isActive: true },
    });
    if (!user?.isActive) throw new UnauthorizedException('Account is unavailable');
    return user;
  }
}
