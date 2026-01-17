import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const totalRevenueAgg = await this.prisma.order.aggregate({
      _sum: { total: true },
      where: { status: 'Completed' }
    });
    
    const activeOrdersCount = await this.prisma.order.count({
        where: { status: { in: ['Pending', 'Processing'] } }
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
      lowStock: lowStockCount
    };
  }
}
