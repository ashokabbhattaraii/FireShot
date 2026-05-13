import 'reflect-metadata';
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';
import type { Express, Request, Response } from 'express';
import { AppModule } from './app.module';

let serverPromise: Promise<Express> | null = null;

export async function createApp(opts: { createStaticDirs?: boolean } = {}): Promise<INestApplication> {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProd ? ['error', 'warn'] : ['error', 'warn', 'log'],
  });

  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins?.length
      ? (origin, cb) => {
          if (!origin) return cb(null, true);
          const normalized = origin.replace(/\/+$/, '');
          cb(null, corsOrigins.includes('*') || corsOrigins.includes(normalized));
        }
      : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: false,
      forbidNonWhitelisted: false,
      stopAtFirstError: true,
      validationError: { target: false, value: false },
    }),
  );

  if (opts.createStaticDirs) {
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    app.use('/uploads', express.static(join(process.cwd(), uploadDir)));

    const apkDir = process.env.APK_DIR ?? './public/downloads';
    if (!existsSync(apkDir)) mkdirSync(apkDir, { recursive: true });
    app.use('/downloads', express.static(join(process.cwd(), apkDir)));

    const bannerDir = process.env.BANNER_DIR ?? './public/banners';
    if (!existsSync(bannerDir)) mkdirSync(bannerDir, { recursive: true });
    app.use('/banners', express.static(join(process.cwd(), bannerDir)));
  }

  return app;
}

async function getServer() {
  if (serverPromise) return serverPromise;
  serverPromise = (async () => {
    const app = await createApp();
    await app.init();
    return app.getHttpAdapter().getInstance();
  })();
  return serverPromise;
}

export default async function handler(req: Request, res: Response) {
  const server = await getServer();
  return server(req, res);
}

if (require.main === module) {
  (async () => {
    const app = await createApp({ createStaticDirs: true });
    const port = parseInt(process.env.PORT ?? '4000', 10);
    await app.listen(port, '0.0.0.0');
    console.log(`API ready on port ${port}`);
  })();
}
