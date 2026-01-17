import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_KEY_ALL = 'blogs:all';
const CACHE_KEY_PREFIX = 'blogs:';

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll() {
    const cached = await this.cacheManager.get(CACHE_KEY_ALL);
    if (cached) {
      console.log('[BlogService] Cache hit for blogs:all');
      return cached;
    }

    console.log('[BlogService] Cache miss for blogs:all - fetching from DB');
    const blogs = await this.prisma.blogPost.findMany({
      where: {
        status: 'Published',
      },
      orderBy: {
        date: 'desc',
      },
    });

    await this.cacheManager.set(CACHE_KEY_ALL, blogs);
    return blogs;
  }

  async findOne(id: string) {
    const cacheKey = `${CACHE_KEY_PREFIX}${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      console.log(`[BlogService] Cache hit for ${cacheKey}`);
      return cached;
    }

    console.log(`[BlogService] Cache miss for ${cacheKey} - fetching from DB`);
    const blog = await this.prisma.blogPost.findUnique({
      where: { id },
    });

    if (blog) {
      await this.cacheManager.set(cacheKey, blog);
    }
    return blog;
  }
}
