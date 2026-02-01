import { Injectable, Inject, BadRequestException } from '@nestjs/common';
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
    
    if (updateProductDto.stock !== undefined) {
      const stock = updateProductDto.stock;
      let status: string;
      
      if (stock === 0) {
        status = 'Out of Stock';
      } else if (stock <= 10) {
        status = 'Low Stock';
      } else {
        status = 'In Stock';
      }
      
      updateProductDto.status = status;
      console.log(`[ProductsService] Auto-updating status for product ${id}: stock=${stock}, status="${status}"`);
    }

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

  /**
   * Update product status based on stock level
   * Low Stock: <= 10 units
   * Out of Stock: 0 units
   * In Stock: > 10 units 
   */
  private async updateStockStatus(productId: string, stock: number) {
    let status: string;
    
    if (stock === 0) {
      status = 'Out of Stock';
    } else if (stock <= 10) {
      status = 'Low Stock';
    } else {
      status = 'In Stock';
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { status },
    });

    await this.invalidateCache(productId);
  }

  /**
   * Decrease stock for a product (used when orders are placed)
   */
  async decreaseStock(productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException(`Product ${productId} not found`);
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${quantity}`
      );
    }

    const newStock = product.stock - quantity;
    
    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    // Update status based on new stock level
    await this.updateStockStatus(productId, newStock);

    console.log(`[ProductsService] Stock decreased for ${product.name}: ${product.stock} -> ${newStock}`);
  }

  /**
   * Check if sufficient stock is available for a product
   */
  async checkStockAvailability(productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return {
        available: false,
        stock: 0,
        message: 'Product not found',
      };
    }

    const isAvailable = product.stock >= quantity;
    
    return {
      available: isAvailable,
      stock: product.stock,
      message: isAvailable 
        ? 'Stock available' 
        : `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`,
    };
  }
}
