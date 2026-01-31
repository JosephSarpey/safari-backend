import { IsString, IsNumber } from 'class-validator';

export class CheckStockDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;
}
