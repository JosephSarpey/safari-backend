import { IsString, IsArray } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  title: string;

  @IsString()
  author: string;

  @IsString()
  image: string;

  @IsString()
  excerpt: string;

  @IsString()
  content: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsString()
  category: string;

  @IsString()
  status: string;
}
