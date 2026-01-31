import { Controller, Post, Get, Body, Param, Headers, Req, HttpCode } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateOrderFromPaymentDto } from './dto/create-order-from-payment.dto';
import type { Request } from 'express';
import { OrdersService } from '../admin/orders/orders.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post('create-intent')
  async createPaymentIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDto) {
    return this.paymentService.createPaymentIntent(createPaymentIntentDto);
  }

  @Get(':id')
  async getPaymentIntent(@Param('id') id: string) {
    return this.paymentService.retrievePaymentIntent(id);
  }

  @Post('create-order')
  async createOrderFromPayment(@Body() createOrderDto: CreateOrderFromPaymentDto) {
    // Check if order already exists for this payment intent
    const existingOrder = await this.ordersService.findByPaymentIntent(
      createOrderDto.paymentIntentId
    );

    if (existingOrder) {
      return existingOrder;
    }

    // Create new order
    return this.ordersService.createFromPayment({
      paymentIntentId: createOrderDto.paymentIntentId,
      total: createOrderDto.total,
      items: createOrderDto.items,
      userId: createOrderDto.userId,
    });
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!request.rawBody) {
      throw new Error('Raw body is required for webhook signature verification');
    }

    const event = await this.paymentService.handleWebhook(
      signature,
      request.rawBody,
    );

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object);
        // Here you would update order status, send confirmation email, etc.
        break;
      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object);
        // Handle failed payment
        break;
      case 'payment_intent.canceled':
        console.log('Payment canceled:', event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  }

  @Post('cancel/:id')
  async cancelPaymentIntent(@Param('id') id: string) {
    return this.paymentService.cancelPaymentIntent(id);
  }
}
