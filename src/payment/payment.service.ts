import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-01-28.clover',
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
}
