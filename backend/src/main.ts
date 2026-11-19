import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getAllowedFrontendOrigins, getDefaultFrontendUrl } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = process.env.FRONTEND_URL ?? getDefaultFrontendUrl(process.env.NODE_ENV);
  const frontendOrigins = getAllowedFrontendOrigins(frontendUrl);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }));
  app.use(cookieParser());
  app.enableCors({ origin: frontendOrigins, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DropStore API')
    .setDescription('Versioned DropStore REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
