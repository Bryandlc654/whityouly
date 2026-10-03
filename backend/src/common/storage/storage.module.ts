import { Global, Module } from '@nestjs/common';
import { env } from '../../config/env';
import { LocalMediaStorage } from './local-media-storage';
import { MEDIA_STORAGE } from './media-storage';
import { S3MediaStorage } from './s3-media-storage';

/**
 * Selecciona el driver de almacenamiento al arrancar. Que sea global evita
 * reconfigurar `StorageModule` en cada módulo de features que necesite medios.
 */
@Global()
@Module({
  providers: [
    {
      provide: MEDIA_STORAGE,
      useFactory: (): LocalMediaStorage | S3MediaStorage =>
        env.storage.driver === 's3' ? new S3MediaStorage() : new LocalMediaStorage(),
    },
  ],
  exports: [MEDIA_STORAGE],
})
export class MediaStorageModule {}
