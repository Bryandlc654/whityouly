import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Seguridad base
  app.use(helmet());
  app.enableCors(); // TODO: Ajustar orígenes en producción

  // Pipes globales (Validación de DTOs automatizada)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
  await app.listen(3000);
  console.log(`🚀 Servidor corriendo en: http://localhost:3000`);
  console.log(`📚 Swagger disponible en: http://localhost:3000/api/docs`);
}
bootstrap();
