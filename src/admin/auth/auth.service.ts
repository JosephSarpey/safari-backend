import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.admin.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new UnauthorizedException({
        message: 'Account is temporarily locked.',
        lockoutUntil: user.lockoutUntil,
      });
    }

    if (await bcrypt.compare(pass, user.password)) {
      // Successful login
      await this.prisma.admin.update({
        where: { email },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });
      const { password, ...result } = user;
      return result;
    } else {
      // Failed login
      const attempts = user.failedLoginAttempts + 1;
      const lockoutUntil = attempts >= 3 ? new Date(Date.now() + 5 * 60 * 1000) : null; // 5 minutes lockout

      await this.prisma.admin.update({
        where: { email },
        data: {
          failedLoginAttempts: attempts,
          lockoutUntil: lockoutUntil,
        },
      });

      return null;
    }
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, name: user.name };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
