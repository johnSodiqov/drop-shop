import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(id: string) {
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
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, input: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id },
      data: { name: input.name?.trim() },
    });
    return this.profile(id);
  }
}
