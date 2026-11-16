import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterDto): Promise<{ accessToken: string; user: object; refreshToken: string }> {
    if (Buffer.byteLength(input.password, 'utf8') > 72) {
      throw new BadRequestException('Password exceeds the bcrypt 72-byte limit');
    }
    const existing = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) throw new ConflictException('An account with this phone already exists');

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          phone: input.phone,
          name: input.name.trim(),
          passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('An account with this phone already exists');
      throw error;
    }
    return this.issueTokens(user);
  }

  async login(input: LoginDto): Promise<{ accessToken: string; user: object; refreshToken: string }> {
    if (Buffer.byteLength(input.password, 'utf8') > 72) {
      throw new BadRequestException('Password exceeds the bcrypt 72-byte limit');
    }
    const user = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Phone or password is incorrect');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; user: object; refreshToken: string }> {
    if (!refreshToken) throw new UnauthorizedException('Refresh token is missing');
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (
      !user?.isActive ||
      !user.refreshTokenHash ||
      !(await bcrypt.compare(refreshToken, user.refreshTokenHash))
    ) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      return;
    }
    await this.prisma.user.updateMany({
      where: { id: payload.sub, refreshTokenHash: { not: null } },
      data: { refreshTokenHash: null },
    });
  }

  async currentUser(id: string): Promise<object> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true,
        agentProfile: { select: { referralCode: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async issueTokens(user: User): Promise<{
    accessToken: string;
    user: object;
    refreshToken: string;
  }> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, nonce: randomBytes(16).toString('hex') },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await bcrypt.hash(refreshToken, BCRYPT_ROUNDS) },
    });
    return {
      accessToken,
      refreshToken,
      user: await this.currentUser(user.id),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
