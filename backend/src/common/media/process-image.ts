import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/** MIME declarados que aceptamos. La verificación real se hace sobre los bytes. */
export const IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_MIME_TYPES = new Set(IMAGE_ALLOWED_MIME_TYPES);
const OUTPUT_MIME = 'image/webp';

export interface ImageInput {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ImageLimits {
  maxBytes: number;
  maxPixels: number;
  quality: number;
  /** Lado mayor del resultado. Si se omite, la imagen conserva su tamaño. */
  maxDimension?: number;
  /** Recorta a un cuadrado, como necesita un avatar. */
  square?: number;
}

export function assertImageLooksValid(file: ImageInput, maxBytes: number): void {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException('El archivo de imagen está vacío.');
  }

  if ((file.size ?? 0) > maxBytes || file.buffer.length > maxBytes) {
    throw new PayloadTooLargeException(
      `La imagen supera el máximo de ${Math.floor(maxBytes / 1024)} KB.`,
    );
  }

  // Criba rápida por MIME declarado. No es la validación definitiva: esa la
  // hace sharp leyendo la cabecera real del archivo.
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    throw new UnsupportedMediaTypeException('Solo se aceptan imágenes JPEG, PNG o WebP.');
  }
}

/**
 * Normaliza una imagen a WebP y devuelve sus dimensiones.
 *
 * Re-codificar siempre tiene tres ventajas frente a guardar el archivo tal cual:
 * el `Content-Type` declarado por el cliente deja de importar (nos fiamos de los
 * bytes), SVG/HTML incrustados y payloads polimórficos pierden su efecto, y se
 * descartan los metadatos EXIF, que incluyen geolocalización.
 */
export async function processImage(
  buffer: Buffer,
  limits: ImageLimits,
): Promise<ProcessedImage> {
  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: limits.maxPixels,
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new BadRequestException('El archivo no es una imagen válida o está corrupto.');
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    // Cubre SVG y cualquier formato no soportado, que son vectores de XSS.
    throw new UnsupportedMediaTypeException('Formato no permitido. Usa JPEG, PNG o WebP.');
  }

  const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
  if (pixels <= 0 || pixels > limits.maxPixels) {
    throw new BadRequestException('La imagen tiene dimensiones no permitidas.');
  }

  try {
    const pipeline = sharp(buffer, { failOn: 'error', limitInputPixels: limits.maxPixels })
      // Aplica la orientación EXIF y luego la descarta.
      .rotate();

    const resized = limits.square
      ? pipeline.resize(limits.square, limits.square, {
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: true,
        })
      : limits.maxDimension
        ? pipeline.resize({
            width: limits.maxDimension,
            height: limits.maxDimension,
            fit: 'inside',
            withoutEnlargement: true,
          })
        : pipeline;

    const output = await resized.webp({ quality: limits.quality, effort: 4 }).toBuffer();
    const outputMetadata = await sharp(output).metadata();

    return {
      buffer: output,
      mimeType: OUTPUT_MIME,
      width: outputMetadata.width ?? 0,
      height: outputMetadata.height ?? 0,
      sizeBytes: output.byteLength,
    };
  } catch {
    throw new BadRequestException('No se pudo procesar la imagen.');
  }
}
