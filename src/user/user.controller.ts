import { Controller, Get, Request, UseGuards, Patch, Post, Body, NotFoundException, Param, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from '../admin/orders/orders.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

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

  @UseGuards(JwtAuthGuard)
  @Get('orders')
  async getOrders(@Request() req) {
    // Fetch all orders for the authenticated user
    const orders = await this.ordersService.findAll();
    // Filter orders for this specific user
    return orders.filter(order => order.userId === req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id')
  async getOrder(@Request() req, @Param('id') id: string) {
    const order = await this.ordersService.findOne(id);
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Ensure the order belongs to the authenticated user
    if (order.userId !== req.user.userId) {
      throw new ForbiddenException('You do not have permission to view this order');
    }

    return order;
  }
}
