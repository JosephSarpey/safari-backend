import { Controller, Post, UseGuards, Request, Body, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
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
        
        res.cookie('access_token', loginData.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        return { user: loginData.user };
    } catch (e) {
        throw e;
    }
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    return { message: 'Logged out successfully' };
  }

  @Post('signup')
  async signup(@Body() signUpDto: any) {
    return this.authService.register(signUpDto);
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
      
    
      res.cookie('access_token', data.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000,
      });

      res.redirect(`${frontendUrl}${targetPath}?token=${data.access_token}`);
  }
  
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
      const token = await this.authService.generateResetToken(body.email);
      return { message: 'If email exists, reset token generated (simulated)', token }; 
  }
  
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string, password: string }) {
      return this.authService.resetPassword(body.token, body.password);
  }
}
