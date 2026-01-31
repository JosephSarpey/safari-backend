import { Controller, Post, UseGuards, Request, Body, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Response, CookieOptions } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

// Detect production environment more reliably
const isProduction = () => {
  // Check multiple indicators for production environment
  return process.env.NODE_ENV === 'production' || 
         process.env.FRONTEND_URL?.includes('vercel.app') ||
         process.env.FRONTEND_URL?.includes('https://');
};

// Reusable cookie configuration
const getCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'none' : 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 1 day
});

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
        
        res.cookie('access_token', loginData.access_token, getCookieOptions());

        return { user: loginData.user, access_token: loginData.access_token };
    } catch (e) {
        throw e;
    }
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    // Must use same cookie options for clearCookie to work in cross-origin setup
    const { maxAge, ...clearOptions } = getCookieOptions();
    res.clearCookie('access_token', clearOptions);
    return { message: 'Logged out successfully' };
  }

  @Post('signup')
  async signup(@Body() signUpDto: any) {
    return this.authService.register(signUpDto);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string, otp: string }, @Res({ passthrough: true }) res: Response) {
      const loginData = await this.authService.verifyOtp(body.email, body.otp);
      
      res.cookie('access_token', loginData.access_token, getCookieOptions());

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
      
      // Set httpOnly cookie with the access token
      res.cookie('access_token', data.access_token, getCookieOptions());

      // Redirect to the frontend callback page
      // The callback page will fetch the user profile using the cookie
      res.redirect(`${frontendUrl}/auth/callback`);
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
