import { IsNumber, IsString, IsOptional, IsObject } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    customerEmail: string;
    customerName?: string;
    items?: any[];
    userId?: string;
  };
}
