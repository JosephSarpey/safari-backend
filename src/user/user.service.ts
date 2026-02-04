import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.prisma.user.create({
      data,
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { addresses: true },
    });
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    if (data.password && typeof data.password === 'string') {
        data.password = await bcrypt.hash(data.password, 10);
    }
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002' && (error.meta?.target as string[])?.includes('email')) {
            throw new BadRequestException('Email already in use');
        }
      }
      throw error;
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new Error('User not found or password not set');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
        // 1. Delete user addresses
        await prisma.address.deleteMany({
            where: { userId },
        });

        // 2. Anonymize orders (set userId to null)
        await prisma.order.updateMany({
            where: { userId },
            data: { userId: null },
        });

        // 3. Anonymize chat sessions (set userId to null)
        await prisma.chatSession.updateMany({
            where: { userId },
            data: { userId: null },
        });

        // 4. Delete the user
        await prisma.user.delete({
            where: { id: userId },
        });
    });
  }
}
