import { IsString, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;
}

export class CreateOrderFromPaymentDto {
  @IsString()
  paymentIntentId: string;

  @IsNumber()
  total: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  customerEmail?: string;

  @IsOptional()
  customerName?: string;
}
