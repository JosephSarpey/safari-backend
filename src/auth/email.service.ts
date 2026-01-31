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
    
    this.logger.log(`Email service initialized with Resend. From email: ${this.fromEmail}`);
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    try {
      this.logger.log(`Attempting to send password reset email to: ${to}`);
      
      const result = await this.resend.emails.send({
        from: `Safari Roast <${this.fromEmail}>`,
        to: [to],
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
              <h2>Password Reset Request</h2>
              <p>You requested a password reset for your Safari Coffee account.</p>
              <p>Please click the button below to reset your password:</p>
              <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #D4AF37; color: #000; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
              <p>If you did not request this, please ignore this email.</p>
              <p>This link will expire in 1 hour.</p>
          </div>
        `,
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
    try {
      this.logger.log(`Attempting to send OTP email to: ${to}`);
      
      const result = await this.resend.emails.send({
        from: `Safari Roast <${this.fromEmail}>`,
        to: [to],
        subject: 'Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
              <h2>Verification Code</h2>
              <p>Your verification code is:</p>
              <h1 style="color: #D4AF37; letter-spacing: 5px;">${otp}</h1>
              <p>This code will expire in 10 minutes.</p>
              <p>If you did not request this, please ignore this email.</p>
          </div>
        `,
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
}
