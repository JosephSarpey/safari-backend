import { Injectable, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../auth/email.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
  ) {}

  // Admin doesn't typically create orders manually via this API, but leaving for completeness if needed
  create(createOrderDto: CreateOrderDto) {
    return 'This action adds a new order'; 
  }

  findAll() {
    return this.prisma.order.findMany({
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    // Get original order to compare status
    const oldOrder = await this.prisma.order.findUnique({ where: { id } });
    
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateOrderDto,
      include: { user: true },
    });

    // Check if status changed
    if (oldOrder && updateOrderDto.status && oldOrder.status !== updateOrderDto.status) {
      if (updatedOrder.user?.email) {
        await this.emailService.sendOrderStatusUpdateEmail(updatedOrder.user.email, updatedOrder);
      }
    }

    return updatedOrder;
  }

  remove(id: string) {
    return this.prisma.order.delete({
      where: { id },
    });
  }

  /**
   * Create an order from a successful payment
   */
  async createFromPayment(data: {
    paymentIntentId: string;
    total: number;
    items: Array<{ productId: string; quantity: number; price: number }>;
    userId?: string;
  }) {
    try {
      // First, validate stock availability for all items
      for (const item of data.items) {
        const stockCheck = await this.productsService.checkStockAvailability(
          item.productId,
          item.quantity
        );

        if (!stockCheck.available) {
          throw new BadRequestException(stockCheck.message);
        }
      }

      // Use transaction to ensure atomicity of order creation and stock updates
      const order = await this.prisma.$transaction(async (tx) => {
        // Create the order
        const newOrder = await tx.order.create({
          data: {
            total: data.total,
            status: 'Processing',
            paymentIntentId: data.paymentIntentId,
            paymentStatus: 'succeeded',
            paymentMethod: 'stripe',
            userId: data.userId,
            items: {
              create: data.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              })),
            },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            user: true,
          },
        });

        // Decrease stock for each item
        for (const item of data.items) {
          await this.productsService.decreaseStock(item.productId, item.quantity);
        }

        return newOrder;
      });

      // Send confirmation email
      try {
        if (order.user?.email) {
          await this.emailService.sendOrderConfirmationEmail(order.user.email, order);
        }
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
        // Do not throw error here, as order is already created successfully
      }

      return order;
    } catch (error: any) {
      // If unique constraint failed, order already exists - fetch and return it
      if (error.code === 'P2002' && error.meta?.target?.includes('paymentIntentId')) {
        console.log(`Order already exists for payment intent ${data.paymentIntentId}, returning existing order`);
        return this.findByPaymentIntent(data.paymentIntentId);
      }
      // Re-throw other errors (including stock validation errors)
      throw error;
    }
  }

  /**
   * Find order by payment intent ID
   */
  async findByPaymentIntent(paymentIntentId: string) {
    return this.prisma.order.findUnique({
      where: { paymentIntentId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
      },
    });
  }
}
