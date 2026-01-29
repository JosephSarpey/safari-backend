import { IsString, IsNumber, IsArray, IsEnum, IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  price: number;

  @IsNumber()
  stock: number;

  @IsString()
  image: string;

  @IsString()
  category: string;

  @IsString()
  roast: string;

  @IsString()
  profile: string;

  @IsString()
  origin: string;

  @IsArray()
  @IsString({ each: true })
  weight: string[];

  @IsString()
  type: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;
}
