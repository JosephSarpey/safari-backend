import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { AdminAuthModule } from './admin/auth/auth.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AddressModule } from './address/address.module';
import { ChatModule } from './chat/chat.module';
import { BlogModule as PublicBlogModule } from './blog/blog.module';
import { ProductModule as PublicProductModule } from './product/product.module';
import { CacheModule } from './cache/cache.module';


import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ProductsModule } from './admin/products/products.module';
import { OrdersModule } from './admin/orders/orders.module';
import { CustomersModule } from './admin/customers/customers.module';
import { BlogModule } from './admin/blog/blog.module';
import { DashboardModule } from './admin/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    CacheModule,
    UserModule,
    AuthModule,
    AdminAuthModule,
    AddressModule,
    ChatModule,
    PublicBlogModule,
    PublicProductModule,
    ThrottlerModule.forRoot([{
        ttl: 60000,
        limit: 10,
      }]),
    ProductsModule,
    OrdersModule,
    CustomersModule,
    BlogModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
