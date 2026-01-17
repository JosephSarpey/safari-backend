import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.blogPost.findMany({
      where: {
        status: 'Published',
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.blogPost.findUnique({
      where: { id },
    });
  }
}
