export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface PutObjectInput {
  /** Clave relativa del objeto. Nunca debe provenir de entrada sin sanitizar. */
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

export interface MediaStorage {
  /** Identificador del driver activo, útil para diagnóstico. */
  readonly driver: 'local' | 's3';
  /** URL pública (absoluta) de un objeto ya subido. */
  publicUrl(key: string): string;
  put(input: PutObjectInput): Promise<void>;
  delete(key: string): Promise<void>;
  /** Borra el objeto solo si la clave pertenece a nuestro espacio de nombres. */
  deleteIfOwned(key: string): Promise<boolean>;
}
