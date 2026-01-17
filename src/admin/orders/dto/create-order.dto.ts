import { IsString, IsEnum } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  status: string;
}
