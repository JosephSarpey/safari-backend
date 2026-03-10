import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-09-30.clover' as any,
    });
  }

  /**
   * Create a payment intent for the checkout process
   */
  async createPaymentIntent(createPaymentIntentDto: CreatePaymentIntentDto) {
    try {
      const { amount, currency, metadata } = createPaymentIntentDto;

      if (!amount || amount <= 0 || isNaN(amount)) {
        throw new BadRequestException(`Invalid amount: ${amount}. Amount must be a positive number.`);
      }

      const amountInCents = Math.round(amount * 100);
      const stripeMetadata: Record<string, string | number | null> = {};
      if (metadata) {
        if (metadata.customerEmail) {
          stripeMetadata.customerEmail = metadata.customerEmail;
        }
        if (metadata.customerName) {
          stripeMetadata.customerName = metadata.customerName;
        }
        if (metadata.items) {
          stripeMetadata.items = JSON.stringify(metadata.items);
        }
        if (metadata.userId) {
          stripeMetadata.userId = metadata.userId;
        }
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency || 'usd',
        metadata: stripeMetadata,
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: metadata?.customerEmail || undefined,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Retrieve payment intent details
   */
  async retrievePaymentIntent(paymentIntentId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      throw new BadRequestException(`Failed to retrieve payment intent: ${error.message}`);
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      return event;
    } catch (error) {
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      throw new BadRequestException(`Failed to cancel payment intent: ${error.message}`);
    }
  }

  /**
   * Retry payment for a failed/pending order.
   * Creates a new Stripe PaymentIntent and updates the Order record with the new intent.
   */
  async retryPaymentForOrder(orderId: string) {
    try {
      // Find the order
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { product: true } },
          user: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // Only allow retry for orders that haven't been paid yet
      if (order.paymentStatus === 'succeeded') {
        throw new BadRequestException('This order has already been paid successfully.');
      }

      const amountInCents = Math.round(order.total * 100);

      // Build metadata with the order items (needed for success page to re-attach items)
      const itemsMetadata = order.items.map((item: any) => ({
        id: item.productId,
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        weight: item.weight,
      }));

      // Create a fresh PaymentIntent for the same total
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          customerEmail: order.user?.email || '',
          customerName: order.user?.name || '',
          userId: order.userId || '',
          items: JSON.stringify(itemsMetadata),
          retryForOrderId: orderId,
        },
        automatic_payment_methods: { enabled: true },
        receipt_email: order.user?.email || undefined,
      });

      // Update the order with the new payment intent — reset to pending so the
      // success page can re-confirm it after payment completes
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentIntentId: paymentIntent.id,
          paymentStatus: 'pending',
        },
      });

      console.log(`[PaymentService] Retry payment intent created for order ${orderId}: ${paymentIntent.id}`);

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create retry payment intent: ${error.message}`);
    }
  }
}

