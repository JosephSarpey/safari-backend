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

    const recentOrders = await this.prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        total: true,
        createdAt: true,
        user: {
          select: { name: true },
        },
      },
    });

    const recentActivity = recentOrders.map((order) => ({
      id: order.id,
      customerName: order.user?.name || 'Guest',
      total: order.total,
      createdAt: order.createdAt,
    }));

    // Chart 1: Order status breakdown
    const allStatuses = ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Completed', 'Cancelled'];
    const statusCounts = await Promise.all(
      allStatuses.map((s) => this.prisma.order.count({ where: { status: s } }))
    );
    const orderStatusChart = allStatuses
      .map((status, i) => ({ name: status, value: statusCounts[i] }))
      .filter((s) => s.value > 0);

    // Chart 2: Customer type split
    const customerCount = await this.prisma.user.count({ where: { role: 'CUSTOMER' } });
    const companyCount = await this.prisma.user.count({ where: { role: 'COMPANY' } });
    const customerTypeChart = [
      { name: 'Individual', value: customerCount },
      { name: 'Company', value: companyCount },
    ].filter((s) => s.value > 0);

    // Chart 3: Retention — users with >1 order are returning
    const usersWithOrders = await this.prisma.user.findMany({
      select: { _count: { select: { orders: true } } },
    });
    const returningUsers = usersWithOrders.filter((u) => u._count.orders > 1).length;
    const newUsers = usersWithOrders.filter((u) => u._count.orders === 1).length;
    const retentionChart = [
      { name: 'Returning', value: returningUsers },
      { name: 'New', value: newUsers },
    ].filter((s) => s.value > 0);

    return {
      revenue: totalRevenue,
      activeOrders: activeOrdersCount,
      totalOrders: totalOrdersCount,
      lowStock: lowStockCount,
      revenueChart: await this.getMonthlyRevenue(),
      recentActivity,
      analyticsCharts: {
        orderStatus: orderStatusChart,
        customerType: customerTypeChart,
        retention: retentionChart,
      },
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
