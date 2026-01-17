import { Controller, Post, UseGuards, Request, Body, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() req, @Res({ passthrough: true }) res: Response) {
    
    try {
        const validUser = await this.authService.validateUser(req.email, req.password);
        if (!validUser) {
            throw new UnauthorizedException('Invalid credentials');
        }
        const loginData = await this.authService.login(validUser);
        
        res.cookie('refresh_token', loginData.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return { user: loginData.user, access_token: loginData.access_token };
    } catch (e) {
        throw e;
    }
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  @SkipThrottle()
  @Post('refresh')
  async refresh(@Req() req, @Res({ passthrough: true }) res: Response) {
      // The cookie-parser middleware should populate req.cookies
      const refreshToken = req.cookies['refresh_token'];
      if (!refreshToken) {
          throw new UnauthorizedException('No refresh token found');
      }

      const loginData = await this.authService.refresh(refreshToken);

      // Rotate refresh token
      res.cookie('refresh_token', loginData.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return { access_token: loginData.access_token, user: loginData.user };
  }

  @Post('signup')
  async signup(@Body() signUpDto: any) {
    return this.authService.register(signUpDto);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string, otp: string }, @Res({ passthrough: true }) res: Response) {
      const loginData = await this.authService.verifyOtp(body.email, body.otp);
      
      res.cookie('refresh_token', loginData.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return { user: loginData.user, access_token: loginData.access_token };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
      const data = await this.authService.googleLogin(req);
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const targetPath = data.user.role === 'COMPANY' ? '/account/company' : '/account/user';
      
    
      res.cookie('refresh_token', data.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect without token in URL, frontend will init session via refresh endpoint
      res.redirect(`${frontendUrl}${targetPath}`);
  }
  
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
      await this.authService.generateResetToken(body.email);
      return { message: 'If an account with that email exists, we have sent a password reset link.' }; 
  }
  
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string, password: string }) {
      return this.authService.resetPassword(body.token, body.password);
  }
}
