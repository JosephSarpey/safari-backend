import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const totalRevenueAgg = await this.prisma.order.aggregate({
      _sum: { total: true },
      where: { 
        status: { 
          in: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Completed'] 
        } 
      }
    });
    
    const activeOrdersCount = await this.prisma.order.count({
        where: { status: { in: ['Pending', 'Processing', 'Shipped', 'Out for Delivery'] } }
    });

    const totalOrdersCount = await this.prisma.order.count();
    
    // Revenue formatted could be done in frontend, but sending number
    const totalRevenue = totalRevenueAgg._sum.total || 0;

    const lowStockCount = await this.prisma.product.count({
      where: {
        OR: [
            { stock: { lte: 10 } },
            { status: 'Low Stock' }
        ]
      }
    });

    return {
      revenue: totalRevenue,
      activeOrders: activeOrdersCount,
      totalOrders: totalOrdersCount,
      lowStock: lowStockCount,
      revenueChart: await this.getMonthlyRevenue()
    };
  }

  private async getMonthlyRevenue() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); // Start of month

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
        status: { in: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Completed'] }
      },
      select: {
        total: true,
        createdAt: true
      }
    });

    const monthlyData = new Map<string, number>();

    // Initialize last 6 months
    for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthName = d.toLocaleString('default', { month: 'short' });
        monthlyData.set(monthName, 0);
    }

    // Aggregate
    orders.forEach(order => {
        const monthName = order.createdAt.toLocaleString('default', { month: 'short' });
        if (monthlyData.has(monthName)) {
            monthlyData.set(monthName, (monthlyData.get(monthName) || 0) + order.total);
        }
    });

    // Convert to array and reverse to show oldest to newest
    return Array.from(monthlyData, ([name, total]) => ({ name, total })).reverse();
  }
}
