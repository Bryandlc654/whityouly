import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MulterError } from 'multer';

/**
 * Los errores de multer no son `HttpException`, así que sin este filtro
 * escaparían como 500. Los traducimos a códigos honestos para el cliente:
 * un archivo demasiado grande es un 413, no un fallo del servidor.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  catch(exception: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception.code === 'LIMIT_FILE_SIZE' ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST;

    const message = this.describe(exception);
    this.logger.warn(`Subida rechazada en ${request.method} ${request.url}: ${exception.code}`);

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private describe(exception: MulterError): string {
    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        return 'La imagen supera el tamaño máximo permitido.';
      case 'LIMIT_FILE_COUNT':
        return 'Solo se admite un archivo por petición.';
      case 'LIMIT_UNEXPECTED_FILE':
        return 'El campo de archivo esperado es "file".';
      case 'LIMIT_PART_COUNT':
      case 'LIMIT_FIELD_COUNT':
        return 'La petición multipart tiene demasiados campos.';
      default:
        return new HttpException('No se pudo procesar la subida.', HttpStatus.BAD_REQUEST).message;
    }
  }
}
