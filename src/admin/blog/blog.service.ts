import { Injectable } from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  create(createBlogDto: CreateBlogDto) {
    return this.prisma.blogPost.create({
      data: createBlogDto,
    });
  }

  findAll() {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.blogPost.findUnique({
      where: { id },
    });
  }

  update(id: string, updateBlogDto: UpdateBlogDto) {
    return this.prisma.blogPost.update({
      where: { id },
      data: updateBlogDto,
    });
  }

  remove(id: string) {
    return this.prisma.blogPost.delete({
      where: { id },
    });
  }
}
