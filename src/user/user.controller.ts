import { Controller, Get, Request, UseGuards, Patch, Post, Body, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    try {
        const user = await this.userService.findUserById(req.user.userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const { password, ...result } = user;
        return result;
    } catch (e) {
        throw e;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req, @Body() updateData: any) {
      const user = await this.userService.updateUser(req.user.userId, updateData);
      if (!user) {
          throw new NotFoundException('User not found'); 
      }
      const { password, ...result } = user;
      return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Request() req, @Body() body: any) {
    try {
      const { oldPassword, newPassword } = body;
      await this.userService.changePassword(req.user.userId, oldPassword, newPassword);
      return { message: 'Password updated successfully' };
    } catch (e) {
      if (e.message === 'Invalid current password') {
        throw new NotFoundException('Invalid current password'); 
      }
      throw e;
    }
  }
}
