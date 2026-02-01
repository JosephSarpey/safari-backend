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
      console.log('[OrdersService] Starting order creation from payment:', {
        paymentIntentId: data.paymentIntentId,
        itemsCount: data.items.length,
        userId: data.userId,
      });

      // First, validate stock availability for all items
      for (const item of data.items) {
        const stockCheck = await this.productsService.checkStockAvailability(
          item.productId,
          item.quantity
        );

        if (!stockCheck.available) {
          console.error('[OrdersService] Stock validation failed:', stockCheck.message);
          throw new BadRequestException(stockCheck.message);
        }
      }

      console.log('[OrdersService] Stock validation passed, starting transaction');

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

        console.log('[OrdersService] Order created in transaction:', newOrder.id);

        // Decrease stock for each item using the transaction client
        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new BadRequestException(`Product ${item.productId} not found`);
          }

          if (product.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`
            );
          }

          const newStock = product.stock - item.quantity;

          // Update stock
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: newStock },
          });

          // Update status based on new stock level
          let status: string;
          if (newStock === 0) {
            status = 'Out of Stock';
          } else if (newStock <= 10) {
            status = 'Low Stock';
          } else {
            status = 'In Stock';
          }

          await tx.product.update({
            where: { id: item.productId },
            data: { status },
          });

          console.log(`[OrdersService] Stock decreased for ${product.name}: ${product.stock} -> ${newStock}`);
        }

        return newOrder;
      });

      console.log('[OrdersService] Transaction completed successfully');

      // Invalidate product cache after successful order
      for (const item of data.items) {
        await this.productsService['invalidateCache'](item.productId);
      }

      // Send confirmation email
      try {
        if (order.user?.email) {
          console.log('[OrdersService] Sending confirmation email to:', order.user.email);
          await this.emailService.sendOrderConfirmationEmail(order.user.email, order);
        }
      } catch (emailError) {
        console.error('[OrdersService] Failed to send order confirmation email:', emailError);
      }

      // Send notification to business owner
      try {
        console.log('[OrdersService] Sending order notification to business owner');
        await this.emailService.sendNewOrderNotificationToOwner(order);
      } catch (emailError) {
        console.error('[OrdersService] Failed to send order notification to owner:', emailError);
        
      }

      return order;
    } catch (error: any) {
      
      if (error.code === 'P2002' && error.meta?.target?.includes('paymentIntentId')) {
        console.log(`[OrdersService] Order already exists for payment intent ${data.paymentIntentId}, returning existing order`);
        return this.findByPaymentIntent(data.paymentIntentId);
      }
      console.error('[OrdersService] Error creating order from payment:', {
        message: error.message,
        code: error.code,
        paymentIntentId: data.paymentIntentId,
      });
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
