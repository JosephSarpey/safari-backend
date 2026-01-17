
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
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

    return this.transporter.sendMail(mailOptions);
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
