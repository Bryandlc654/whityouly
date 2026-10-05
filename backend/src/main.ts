import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import express from 'express';
import cookieParser = require('cookie-parser');
import { env } from './config/env';
import { MEDIA_STORAGE, type MediaStorage } from './common/storage/media-storage';
import { LocalMediaStorage } from './common/storage/local-media-storage';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Necesario para que el rate limiting vea la IP real detrás de un proxy/balanceador.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', env.trustProxy);

  // Seguridad base. `cross-origin` es obligatorio: los avatares se muestran
  // desde el frontend, que vive en otro origen que la API.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Con el driver local la API sirve los medios; en producción usa S3/CDN.
  const mediaStorage = app.get<MediaStorage>(MEDIA_STORAGE);
  if (mediaStorage.driver === 'local') {
    const basePath = new URL(env.storage.publicBaseUrl).pathname.replace(/\/$/, '') || '/media';
    app.use(
      basePath,
      express.static((mediaStorage as LocalMediaStorage).publicDir(), {
        index: false,
        dotfiles: 'deny',
        redirect: false,
        immutable: true,
        maxAge: '365d',
        fallthrough: true,
        setHeaders: (res) => {
          // Los archivos ya son WebP re-codificados: nunca se sirven como HTML.
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        },
      }),
    );
    console.log(`🖼️  Medios locales servidos en ${env.storage.publicBaseUrl}`);
    if (env.isProduction && env.storage.publicBaseUrlIsLoopback) {
      // No se interrumpe el arranque: es un aviso, no un error, para no dejar
      // el sitio caído mientras se corrige la variable.
      console.warn(
        '⚠️  PUBLIC_MEDIA_BASE_URL apunta a un bucle local: las URLs de los archivos quedarán rotas y no se podrán borrar. Debe ser la URL pública del servicio, por ejemplo https://tu-api.com/media',
      );
    }
    if (env.isProduction) {
      console.warn(
        '⚠️  STORAGE_DRIVER=local en producción: los archivos viven en el disco del contenedor y se pierden en cada despliegue o reinicio. Configura S3/R2.',
      );
    }
  }

  // El refresh token viaja en una cookie httpOnly. Si el navegador no la
  // devuelve, el síntoma es desconectado: el access token caduca y todo lo
  // autenticado responde 401 sin que nada del frontend lo explique.
  if (env.isProduction) {
    if (env.cookie.sameSite !== 'none') {
      console.warn(
        '⚠️  COOKIE_SAMESITE no es "none" y el frontend está en otro dominio: el navegador no enviará la cookie de refresco y las peticiones autenticadas fallarán con 401 al caducar el access token.',
      );
    }
    if (env.cookie.sameSite === 'none' && !env.cookie.secure) {
      console.warn(
        '⚠️  SameSite=None sin Secure: los navegadores descartan la cookie y el refresh de token no funcionará.',
      );
    }
  }

  // Avisos de configuración que no romven nada al arrancar pero que hacen que el
  // backend se quede sin conexiones cuando sube el tráfico.
  if (env.database.usesPooler) {
    if (!env.database.pgbouncer) {
      console.warn(
        '⚠️  La DATABASE_URL usa el pooler sin "pgbouncer=true": Prisma sigue usando sentencias preparadas que PgBouncer no admite y falla de forma intermitente bajo carga.',
      );
    }
    if (!env.database.connectionLimit) {
      console.warn(
        '⚠️  La DATABASE_URL no fija "connection_limit": el pool crece con los nucleos de la instancia y cada conexion abierta ocupa una ranura de Neon. Anade connection_limit=5.',
      );
    }
  }

  // Pipes globales (Validación de DTOs automatizada)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Traduce los errores de subida (multer) a 413/400 en lugar de 500.
  app.useGlobalFilters(new MulterExceptionFilter());

  // Apagado ordenado (relevante para entornos con múltiples instancias)
  app.enableShutdownHooks();

  // Configuración de Swagger (Documentación OpenAPI)
  const config = new DocumentBuilder()
    .setTitle('Whityouly API')
    .setDescription('Documentación de los endpoints del backend de Whityouly')
    .setVersion('1.0')
    .addBearerAuth() // Soporte para JWT en la UI de Swagger
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // Ruta: /api/docs

  // Iniciar el servidor
  await app.listen(env.port);
  console.log(`🚀 Servidor corriendo en: http://localhost:${env.port}`);
  console.log(`📚 Swagger disponible en: http://localhost:${env.port}/api/docs`);
}
bootstrap();
