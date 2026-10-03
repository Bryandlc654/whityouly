import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { isSafeMediaKey } from './media-keys';
import type { MediaStorage, PutObjectInput } from './media-storage';

@Injectable()
export class LocalMediaStorage implements MediaStorage {
  readonly driver = 'local' as const;
  private readonly logger = new Logger(LocalMediaStorage.name);
  private readonly rootDir: string;

  constructor() {
    const configured = env.storage.localDir;
    this.rootDir = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  /** Ruta absoluta servida por la API en development. */
  publicDir(): string {
    return this.rootDir;
  }

  publicUrl(key: string): string {
    if (!isSafeMediaKey(key)) {
      throw new Error('Clave de medio no permitida');
    }
    return `${env.storage.publicBaseUrl}/${key}`;
  }

  async put({ key, body, contentType, cacheControl }: PutObjectInput): Promise<void> {
    const target = this.resolveInsideRoot(key);
    await mkdir(dirname(target), { recursive: true });
    // `wx` evita sobrescribir un objeto existente por accidente.
    await writeFile(target, body, { flag: 'wx', mode: 0o644 });
    this.logger.log(`Objeto local almacenado ${key} (${contentType}, ${cacheControl ?? 'sin cache'})`);
  }

  async delete(key: string): Promise<void> {
    if (!isSafeMediaKey(key)) {
      return;
    }
    try {
      await unlink(this.resolveInsideRoot(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`No se pudo borrar el objeto local ${key}: ${(error as Error).message}`);
      }
    }
  }

  async deleteIfOwned(key: string): Promise<boolean> {
    if (!isSafeMediaKey(key)) {
      return false;
    }
    await this.delete(key);
    return true;
  }

  /** Garantiza que la ruta resuelta sigue dentro del directorio raíz. */
  private resolveInsideRoot(key: string): string {
    if (!isSafeMediaKey(key)) {
      throw new Error('Clave de medio no permitida');
    }
    const target = resolve(this.rootDir, key);
    if (target !== this.rootDir && !target.startsWith(this.rootDir + sep)) {
      throw new Error('La clave de medio escapa del directorio de almacenamiento');
    }
    return target;
  }
}
