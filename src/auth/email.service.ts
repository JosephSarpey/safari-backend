import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not set in environment variables');
      throw new Error('RESEND_API_KEY is not configured');
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@safari-roast.com';
    
    // Check for distributor email env var
    if (!process.env.SAFARI_DISTRIBUTOR_EMAIL) {
      this.logger.warn('SAFARI_DISTRIBUTOR_EMAIL is not set. Order notifications may fail.');
    }

    this.logger.log(`Email service initialized with Resend. From email: ${this.fromEmail}`);
  }

  private getEmailTemplate(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #2C1810; font-family: 'Times New Roman', serif;">Safari Roast</h1>
        </div>
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          ${content}
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #888;">
          <p>&copy; ${new Date().getFullYear()} Safari Coffee. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const text = `Password Reset Request\n\nYou requested a password reset for your Safari Coffee account.\nPlease copy and paste the following link into your browser to reset your password:\n${resetLink}\n\nIf you did not request this, please ignore this email.\nThis link will expire in 1 hour.`;
    
    const htmlContent = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your Safari Coffee account.</p>
      <p>Please click the button below to reset your password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #D4AF37; color: #000; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      </div>
      <p>If you did not request this, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `;

    try {
      this.logger.log(`Attempting to send password reset email to: ${to}`);
      
      const result = await this.resend.emails.send({
        from: `Safari Roast <${this.fromEmail}>`,
        to: [to],
        subject: 'Password Reset Request',
        html: this.getEmailTemplate('Password Reset', htmlContent),
        text: text,
      });

      if (result.error) {
        this.logger.error(`Resend API error: ${result.error.message}`);
        throw new Error(result.error.message);
      }

      this.logger.log(`Password reset email sent successfully. ID: ${result.data?.id}`);
      return result.data;
    } catch (error: any) {
      this.logger.error(`Failed to send password reset email to ${to}. Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendOtpEmail(to: string, otp: string) {
    const text = `Verification Code\n\nYour verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this, please ignore this email.`;
    const htmlContent = `
      <h2>Verification Code</h2>
      <p>Your verification code is:</p>
      <h1 style="color: #D4AF37; letter-spacing: 5px; text-align: center; margin: 20px 0;">${otp}</h1>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `;

    try {
      this.logger.log(`Attempting to send OTP email to: ${to}`);
      
      const result = await this.resend.emails.send({
        from: `Safari Roast <${this.fromEmail}>`,
        to: [to],
        subject: 'Verification Code',
        html: this.getEmailTemplate('Verification Code', htmlContent),
        text: text,
      });

      if (result.error) {
        this.logger.error(`Resend API error: ${result.error.message}`);
        throw new Error(result.error.message);
      }

      this.logger.log(`OTP email sent successfully. ID: ${result.data?.id}`);
      return result.data;
    } catch (error: any) {
      this.logger.error(`Failed to send OTP email to ${to}. Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendOrderConfirmationEmail(to: string, orderDetails: any) {
    try {
      this.logger.log(`Attempting to send order confirmation email to: ${to}`);
      
      const itemsListHtml = orderDetails.items.map((item: any) => 
        `<li style="margin-bottom: 5px;">${item.product.name} x ${item.quantity} - <strong>$${(item.price * item.quantity).toFixed(2)}</strong></li>`
      ).join('');

      const itemsListText = orderDetails.items.map((item: any) => 
        `- ${item.product.name} x ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
      ).join('\n');

      const text = `Thank you for your order!\n\nYour order #${orderDetails.id} has been placed successfully.\nTotal: $${orderDetails.total.toFixed(2)}\n\nItems:\n${itemsListText}\n\nWe will notify you when your order is on its way.`;
      
      const htmlContent = `
          <h2>Thank you for your order!</h2>
          <p>Your order <strong>#${orderDetails.id}</strong> has been placed successfully.</p>
          <p style="font-size: 18px; margin: 20px 0;"><strong>Total: $${orderDetails.total.toFixed(2)}</strong></p>
          <h3>Items:</h3>
          <ul style="list-style-type: none; padding-left: 0;">${itemsListHtml}</ul>
          <p style="margin-top: 20px;">We will notify you when your order is on its way.</p>
      `;

      const result = await this.resend.emails.send({
        from: `Safari Roast <${this.fromEmail}>`,
        to: [to],
        subject: 'Order Confirmation - Safari Coffee',
        html: this.getEmailTemplate('Order Confirmation', htmlContent),
        text: text,
      });

      if (result.error) {
        this.logger.error(`Resend API error: ${result.error.message}`);
      } else {
        this.logger.log(`Order confirmation email sent. ID: ${result.data?.id}`);
      }
      return result.data;
    } catch (error: any) {
      this.logger.error(`Failed to send order confirmation email to ${to}. Error: ${error.message}`, error.stack);
    }
  }

  async sendNewOrderNotificationToOwner(orderDetails: any) {
    const ownerEmail = process.env.OWNER_EMAIL;
    
    if (!ownerEmail) {
      this.logger.error('OWNER_EMAIL environment variable is not defined');
      return;
    }

    try {
      this.logger.log(`Sending new order notification to owner: ${ownerEmail}`);
      
      const itemsListHtml = orderDetails.items.map((item: any) => 
        `<li style="margin-bottom: 10px; padding: 10px; background-color: #f9f9f9; border-left: 3px solid #D4AF37;">
          <strong>${item.product.name}</strong><br/>
          Quantity: ${item.quantity} | Price: $${item.price.toFixed(2)} | Subtotal: <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
        </li>`
      ).join('');

      const itemsListText = orderDetails.items.map((item: any) => 
        `- ${item.product.name} | Qty: ${item.quantity} | Price: $${item.price.toFixed(2)} | Subtotal: $${(item.price * item.quantity).toFixed(2)}`
      ).join('\n');

      const customerInfo = orderDetails.user 
        ? `Customer: ${orderDetails.user.name} (${orderDetails.user.email})`
        : 'Guest Customer';

      const text = `New Order Received\n\nOrder ID: ${orderDetails.id}\n${customerInfo}\nTotal: $${orderDetails.total.toFixed(2)}\nPayment Status: ${orderDetails.paymentStatus}\nOrder Status: ${orderDetails.status}\n\nItems:\n${itemsListText}`;
      
      const htmlContent = `
          <h2 style="color: #D4AF37;">New Order Received</h2>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderDetails.id}</p>
            <p style="margin: 5px 0;"><strong>${customerInfo}</strong></p>
            <p style="margin: 5px 0;"><strong>Payment Status:</strong> <span style="color: green;">${orderDetails.paymentStatus}</span></p>
            <p style="margin: 5px 0;"><strong>Order Status:</strong> ${orderDetails.status}</p>
            <p style="margin: 5px 0; font-size: 20px;"><strong>Total:</strong> <span style="color: #D4AF37;">$${orderDetails.total.toFixed(2)}</span></p>
          </div>
          <h3>Order Items:</h3>
          <ul style="list-style-type: none; padding-left: 0;">${itemsListHtml}</ul>
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            <em>This is an automated notification. Please log in to the admin panel to process this order.</em>
          </p>
      `;

      const result = await this.resend.emails.send({
        from: `Safari Roast <${this.fromEmail}>`,
        to: [ownerEmail],
        subject: `New Order #${orderDetails.id} - $${orderDetails.total.toFixed(2)}`,
        html: this.getEmailTemplate('New Order Received', htmlContent),
        text: text,
      });

      if (result.error) {
        this.logger.error(`Resend API error: ${result.error.message}`);
      } else {
        this.logger.log(`New order notification sent to owner. ID: ${result.data?.id}`);
      }
      return result.data;
    } catch (error: any) {
      this.logger.error(`Failed to send new order notification to owner. Error: ${error.message}`, error.stack);
      // Don't throw error - we don't want to fail order creation if notification fails
    }
  }

  async sendOrderStatusUpdateEmail(to: string, orderDetails: any) {
    try {
      this.logger.log(`Attempting to send order status update email to: ${to}`);
      
      const text = `Order Update\n\nYour order #${orderDetails.id} status has been updated to: ${orderDetails.status}\n\nYou can check the details in your account.\nThank you for choosing Safari Coffee.`;

      const htmlContent = `
          <h2>Order Update</h2>
          <p>Your order <strong>#${orderDetails.id}</strong> status has been updated to:</p>
          <h3 style="color: #D4AF37; font-size: 24px; text-align: center; margin: 20px 0;">${orderDetails.status}</h3>
          <p>You can check the details in your account.</p>
          <p>Thank you for choosing Safari Coffee.</p>
      `;

      const result = await this.resend.emails.send({
        from: `Safari Roast <${this.fromEmail}>`,
        to: [to],
        subject: `Order Update - ${orderDetails.status}`,
        html: this.getEmailTemplate('Order Update', htmlContent),
        text: text,
      });

      if (result.error) {
         this.logger.error(`Resend API error: ${result.error.message}`);
      } else {
        this.logger.log(`Order status update email sent. ID: ${result.data?.id}`);
      }
      return result.data;
    } catch (error: any) {
      this.logger.error(`Failed to send order status email to ${to}. Error: ${error.message}`, error.stack);
    }
  }
}
