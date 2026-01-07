import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findUserByEmail(email);
    if (!user) return null;

    // Check for lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        const remainingTime = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 1000);
        throw new UnauthorizedException({
            message: `Account locked. Try again in ${remainingTime} seconds`,
            lockoutUntil: user.lockoutUntil,
            error: 'Account Locked'
        });
    }

    if (user.password && (await bcrypt.compare(pass, user.password))) {
      // Reset failures on success
      if (user.failedAttempts > 0 || user.lockoutUntil) {
          await this.userService.updateUser(user.id, {
              failedAttempts: 0,
              lockoutUntil: null
          });
      }
      const { password, ...result } = user;
      return result;
    }

    // Handle failure
    const newFailedAttempts = (user.failedAttempts || 0) + 1;
    let lockoutUntil: Date | null = null;
    
    if (newFailedAttempts >= 5) {
        lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + 5); // Lock for 5 minutes
    }

    await this.userService.updateUser(user.id, {
        failedAttempts: newFailedAttempts,
        lockoutUntil: lockoutUntil
    });

    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyName: user.companyName,
      }
    };
  }

  async register(registrationData: any) {
    const existingUser = await this.userService.findUserByEmail(registrationData.email);
    if (existingUser) {
        throw new BadRequestException('User with this email already exists');
    }
    
    // Remove taxId if present (deprecated) and ensure other fields are passed
    const { taxId, ...userData } = registrationData;
    
    return this.userService.createUser(userData);
  }

  async generateResetToken(email: string) {
      // TODO: Implement actual email sending
      const user = await this.userService.findUserByEmail(email);
      if (!user) {
          return null; // Don't reveal user existence
      }
      
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1);
      
      await this.userService.updateUser(user.id, {
          resetToken: token,
          resetTokenExpiry: expiry
      });
      
      return token; 
  }

  async resetPassword(token: string, newPassword: string) {
      const user = await this.prisma.user.findFirst({
          where: {
              resetToken: token,
              resetTokenExpiry: {
                  gt: new Date(),
              },
          },
      });

      if (!user) {
          throw new BadRequestException('Invalid or expired reset token');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await this.prisma.user.update({
          where: { id: user.id },
          data: {
              password: hashedPassword,
              resetToken: null,
              resetTokenExpiry: null,
          },
      });

      return { message: 'Password successfully reset' };
  }
  
  async googleLogin(req) {
    if (!req.user) {
      throw new BadRequestException('No user from google');
    }
    return this.login(req.user);
  }
}
