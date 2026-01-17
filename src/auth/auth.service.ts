import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private emailService: EmailService,
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

      // Check verification status
      if (!user.isVerified) {
          await this.generateOtp(user.email);
          throw new HttpException({
              message: 'Account not verified. OTP sent to email.',
              requiresOtp: true,
              email: user.email,
              statusCode: 401,
              error: 'Unauthorized'
          }, HttpStatus.UNAUTHORIZED);
      }

      // Check for inactivity (30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (!user.lastLoginAt || user.lastLoginAt < thirtyDaysAgo) {
          await this.generateOtp(user.email);
          throw new HttpException({
              message: 'Security check required. OTP sent to email.',
              requiresOtp: true,
              email: user.email,
              statusCode: 401,
              error: 'Unauthorized'
          }, HttpStatus.UNAUTHORIZED);
      }

      // Update last login
      await this.userService.updateUser(user.id, {
          lastLoginAt: new Date()
      });

      const { password, ...result } = user;
      return result;
    }

    // Handle failure
    const newFailedAttempts = (user.failedAttempts || 0) + 1;
    let lockoutUntil: Date | null = null;
    
    if (newFailedAttempts >= 3) {
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
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
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
    
    // Create user with isVerified: false
    const newUser = await this.userService.createUser({
        ...userData,
        isVerified: false
    });

    // Generate and send OTP
    await this.generateOtp(newUser.email);

    return { message: 'Registration successful. Please verify your email.' };
  }

  async generateOtp(email: string) {
      const user = await this.userService.findUserByEmail(email);
      if (!user) return;

      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let otp = '';
      for (let i = 0; i < 6; i++) {
        otp += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const expiry = new Date();
      expiry.setMinutes(expiry.getMinutes() + 10);

      await this.userService.updateUser(user.id, {
          otpCode: otp,
          otpExpiry: expiry
      });

      try {
          await this.emailService.sendOtpEmail(user.email, otp);
      } catch (error) {
          console.error('Failed to send OTP email', error);
          // Don't block flow, but log error
      }
  }

  async verifyOtp(email: string, otp: string) {
      const user = await this.userService.findUserByEmail(email);
      
      if (!user) {
          throw new BadRequestException('User not found');
      }

      if (user.otpCode !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
          throw new BadRequestException('Invalid or expired OTP');
      }

      // Verify success
      await this.userService.updateUser(user.id, {
          otpCode: null,
          otpExpiry: null,
          isVerified: true,
          lastLoginAt: new Date()
      });

      // Login user
      return this.login(user);
  }

  async generateResetToken(email: string) {
      const user = await this.userService.findUserByEmail(email);
      if (!user) {
          return null; 
      }
      
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1);
      
      await this.userService.updateUser(user.id, {
          resetToken: token,
          resetTokenExpiry: expiry
      });
      
      try {
        await this.emailService.sendPasswordResetEmail(user.email, token);
      } catch (error) {
          console.error('Failed to send email', error);
          throw new BadRequestException('Failed to send reset email');
      }

      return true; 
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

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userService.findUserByEmail(payload.email);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      
      // Re-issue both tokens (rotating refresh token)
      return this.login(user);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
