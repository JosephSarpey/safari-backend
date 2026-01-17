import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        
        if (!redisUrl) {
          console.warn('REDIS_URL not set, using in-memory cache');
          return {
            ttl: 300000, // 5 minutes in milliseconds
          };
        }

        console.log('[CacheModule] Connecting to Redis...');
        const store = await redisStore({
          url: redisUrl,
          ttl: 300000, // 5 minutes in milliseconds
        });
        console.log('[CacheModule] Successfully connected to Redis');
        return { store };
      },
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
