
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.logger.log(`Initializing email service with host: ${process.env.SMTP_HOST}, port: ${process.env.SMTP_PORT}`);
    
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Add timeouts and pooling for production reliability
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 30000,
      pool: true,
      maxConnections: 5,
    });

    // Verify connection on startup
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(`SMTP connection verification failed: ${error.message}`, error.stack);
      } else {
        this.logger.log('SMTP server connection verified successfully');
      }
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"Safari Roast" <${process.env.SMTP_USER}>`,
      to,
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
    };

    try {
      this.logger.log(`Attempting to send password reset email to: ${to}`);
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent successfully. MessageId: ${result.messageId}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Failed to send password reset email to ${to}. Error: ${error.message}`, error.stack);
      this.logger.error(`SMTP Error Code: ${error.code}, Response: ${error.response}`);
      throw error;
    }
  }

  async sendOtpEmail(to: string, otp: string) {
    const mailOptions = {
      from: `"Safari Roast" <${process.env.SMTP_USER}>`,
      to,
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
    };

    return this.transporter.sendMail(mailOptions);
  }
}
