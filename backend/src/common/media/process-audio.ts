import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { audioExtensionForMime } from '../storage/media-keys';

export interface AudioInput {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

/** MIME declarados que aceptamos. La firma real de los bytes se verifica aparte. */
export const AUDIO_ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
];

const ALLOWED_MIME_TYPES = new Set(AUDIO_ALLOWED_MIME_TYPES);

/**
 * Comprueba que los primeros bytes encajen con una firma de audio conocida.
 * Sin re-codificar (haría falta ffmpeg) esta es la única defensa contra subir
 * un HTML o un ejecutable disfrazado de audio: los reproductores confían en el
 * Content-Type, así que no se sirve como audio algo que no lo parece.
 */
function looksLikeAudio(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  const hex = buffer.subarray(0, 4).toString('hex');

  // OGG: "OggS"
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return true;
  // WAV: "RIFF" .... "WAVE"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return true;
  }
  // WebM/Matroska: EBML header 0x1A45DFA3
  if (hex === '1a45dfa3') return true;
  // MP4/M4A: "ftyp" en el byte 4
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return true;
  // MP3 con etiqueta ID3
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return true;
  // MP3 sin ID3 (sincronía de trama 0xFFEx) o AAC ADTS (0xFFF.).
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;

  return false;
}

/**
 * Convierte el audio a MP3 mono 96 kbps. WebM/Opus es el formato que graban
 * muchos navegadores, pero Safari/iOS no lo reproduce de forma fiable. El MP3
 * es compatible con iPhone, Android y navegadores de escritorio.
 *
 * Devuelve `null` si ffmpeg no está disponible o la conversión falla; en ese
 * caso quien llama conserva el archivo original para no bloquear la subida.
 */
export function transcodeAudioToMp3(input: Buffer): Promise<Buffer | null> {
  const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;
  const TIMEOUT_MS = 60_000;

  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (value: Buffer | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };

    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        'pipe:0',
        '-vn',
        '-ac',
        '1',
        '-ar',
        '44100',
        '-b:a',
        '96k',
        '-f',
        'mp3',
        'pipe:1',
      ],
      { stdio: ['pipe', 'pipe', 'ignore'] },
    );

    const chunks: Buffer[] = [];
    let size = 0;

    timer = setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      finish(null);
    }, TIMEOUT_MS);

    ffmpeg.on('error', () => finish(null));
    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) {
        ffmpeg.kill('SIGKILL');
        finish(null);
        return;
      }
      chunks.push(chunk);
    });
    ffmpeg.on('close', (code) => {
      finish(code === 0 && size > 0 ? Buffer.concat(chunks) : null);
    });

    ffmpeg.stdin.on('error', () => undefined);
    ffmpeg.stdin.end(input);
  });
}

/**
 * Valida un audio declarado y devuelve la extensión con la que guardarlo.
 * La re-codificación a MP3 se hace después; aquí solo se comprueba el tipo y
 * que los bytes iniciales parezcan audio.
 */
export function assertAudioLooksValid(file: AudioInput, maxBytes: number): { extension: string } {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException('El archivo de audio está vacío.');
  }

  if ((file.size ?? 0) > maxBytes || file.buffer.length > maxBytes) {
    throw new PayloadTooLargeException(
      `El audio supera el máximo de ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
    );
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    throw new UnsupportedMediaTypeException(
      'Solo se aceptan audios MP3, M4A, AAC, OGG, WAV o WebM.',
    );
  }

  const extension = audioExtensionForMime(file.mimetype);
  if (!extension) {
    throw new UnsupportedMediaTypeException(
      'Solo se aceptan audios MP3, M4A, AAC, OGG, WAV o WebM.',
    );
  }

  if (!looksLikeAudio(file.buffer)) {
    throw new UnsupportedMediaTypeException('El archivo no parece un audio válido.');
  }

  return { extension };
}
