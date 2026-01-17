import { Injectable } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  create(createCustomerDto: CreateCustomerDto) {
    return 'This action adds a new customer';
  }

  findAll(role?: UserRole) {
    return this.prisma.user.findMany({
      where: role ? { role } : {},
      select: {
         id: true,
         name: true,
         email: true,
         role: true,
         companyName: true,
         phoneNumber: true,
         country: true,
         createdAt: true,
         _count: {
           select: { orders: true }
         }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: true,
      }
    });
  }

  update(id: string, updateCustomerDto: UpdateCustomerDto) {
    return 'This action updates a customer';
  }

  remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
