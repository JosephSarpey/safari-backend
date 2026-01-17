import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_KEY_ALL = 'products:all';
const CACHE_KEY_PREFIX = 'products:';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll() {
    const cached = await this.cacheManager.get(CACHE_KEY_ALL);
    if (cached) {
      console.log('[ProductService] Cache hit for products:all');
      return cached;
    }

    console.log('[ProductService] Cache miss for products:all - fetching from DB');
    const products = await this.prisma.product.findMany({
      where: {
        status: {
          not: 'Out of Stock',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    await this.cacheManager.set(CACHE_KEY_ALL, products);
    return products;
  }

  async findOne(id: string) {
    const cacheKey = `${CACHE_KEY_PREFIX}${id}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      console.log(`[ProductService] Cache hit for ${cacheKey}`);
      return cached;
    }

    console.log(`[ProductService] Cache miss for ${cacheKey} - fetching from DB`);
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (product) {
      await this.cacheManager.set(cacheKey, product);
    }
    return product;
  }
}
