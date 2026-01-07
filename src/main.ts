import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  app.enableCors({
    origin: (origin, callback) => {
        const allowedOrigins = ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:3000', 'https://safari-coffee.vercel.app', 'https://safari-backend-77ds.onrender.com'];
        // Allow Vercel previews
        if (!origin || allowedOrigins.includes(origin) || /^https:\/\/safari-coffee.*\.vercel\.app$/.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
  });

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
