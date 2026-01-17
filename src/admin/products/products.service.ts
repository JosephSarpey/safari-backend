import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '../../prisma/prisma.service';

const CACHE_KEY_ALL = 'products:all';
const CACHE_KEY_PREFIX = 'products:';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: createProductDto,
    });
    await this.invalidateCache();
    console.log('[ProductsService] Cache invalidated after create');
    return product;
  }

  findAll() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
    await this.invalidateCache(id);
    console.log(`[ProductsService] Cache invalidated after update (${id})`);
    return product;
  }

  async remove(id: string) {
    const product = await this.prisma.product.delete({
      where: { id },
    });
    await this.invalidateCache(id);
    console.log(`[ProductsService] Cache invalidated after delete (${id})`);
    return product;
  }

  private async invalidateCache(id?: string) {
    await this.cacheManager.del(CACHE_KEY_ALL);
    if (id) {
      await this.cacheManager.del(`${CACHE_KEY_PREFIX}${id}`);
    }
  }
}
