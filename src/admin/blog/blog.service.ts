import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { PrismaService } from '../../prisma/prisma.service';

const CACHE_KEY_ALL = 'blogs:all';
const CACHE_KEY_PREFIX = 'blogs:';

@Injectable()
export class BlogService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createBlogDto: CreateBlogDto) {
    const blog = await this.prisma.blogPost.create({
      data: createBlogDto,
    });
    await this.invalidateCache();
    console.log('[BlogService Admin] Cache invalidated after create');
    return blog;
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

  async update(id: string, updateBlogDto: UpdateBlogDto) {
    const blog = await this.prisma.blogPost.update({
      where: { id },
      data: updateBlogDto,
    });
    await this.invalidateCache(id);
    console.log(`[BlogService Admin] Cache invalidated after update (${id})`);
    return blog;
  }

  async remove(id: string) {
    const blog = await this.prisma.blogPost.delete({
      where: { id },
    });
    await this.invalidateCache(id);
    console.log(`[BlogService Admin] Cache invalidated after delete (${id})`);
    return blog;
  }

  private async invalidateCache(id?: string) {
    await this.cacheManager.del(CACHE_KEY_ALL);
    if (id) {
      await this.cacheManager.del(`${CACHE_KEY_PREFIX}${id}`);
    }
  }
}
