import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { env } from '../../config/env';
import { isSafeMediaKey } from './media-keys';
import type { MediaStorage, PutObjectInput } from './media-storage';

/**
 * Almacenamiento compatible con S3 (AWS, R2, MinIO, Backblaze...). Es el
 * driver recomendado en producción: permite servir los avatares desde una CDN
 * sin pasar por la API.
 */
@Injectable()
export class S3MediaStorage implements MediaStorage, OnModuleDestroy {
  readonly driver = 's3' as const;
  private readonly logger = new Logger(S3MediaStorage.name);
  private readonly client: S3Client;
  private readonly bucket = env.storage.s3.bucket;

  constructor() {
    this.client = new S3Client({
      region: env.storage.s3.region,
      ...(env.storage.s3.endpoint ? { endpoint: env.storage.s3.endpoint } : {}),
      forcePathStyle: env.storage.s3.forcePathStyle,
      credentials: {
        accessKeyId: env.storage.s3.accessKeyId,
        secretAccessKey: env.storage.s3.secretAccessKey,
      },
    });
  }

  publicUrl(key: string): string {
    if (!isSafeMediaKey(key)) {
      throw new Error('Clave de medio no permitida');
    }
    return `${env.storage.publicBaseUrl}/${key}`;
  }

  async put({ key, body, contentType, cacheControl }: PutObjectInput): Promise<void> {
    if (!isSafeMediaKey(key)) {
      throw new Error('Clave de medio no permitida');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
    this.logger.log(`Objeto almacenado en S3 ${key} (${body.byteLength} bytes)`);
  }

  async delete(key: string): Promise<void> {
    if (!isSafeMediaKey(key)) {
      return;
    }
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.warn(`No se pudo borrar el objeto ${key}: ${(error as Error).message}`);
    }
  }

  async deleteIfOwned(key: string): Promise<boolean> {
    if (!isSafeMediaKey(key)) {
      return false;
    }
    await this.delete(key);
    return true;
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
