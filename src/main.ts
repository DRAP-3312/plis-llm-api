import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const configService = app.get(ConfigService);

  if (configService.get<boolean>('TRUST_PROXY')) {
    app.set('trust proxy', 1);
  }

  app.enableCors({ origin: configService.get<string>('CORS_ORIGIN') });

  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port);
}
void bootstrap();
