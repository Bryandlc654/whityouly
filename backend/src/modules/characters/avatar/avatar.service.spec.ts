import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { AvatarService } from './avatar.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { QuotaService } from '../../../common/quota/quota.service';
import { MEDIA_STORAGE, type MediaStorage } from '../../../common/storage/media-storage';
import { env } from '../../../config/env';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// El servicio solo borra objetos cuya URL pertenezca a `env.storage.publicBaseUrl`.
const BASE = env.storage.publicBaseUrl;

async function makePng(width = 64, height = 64): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe('AvatarService', () => {
  let service: AvatarService;
  let prisma: {
    character: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    mediaAsset: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let storage: MediaStorage & {
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteIfOwned: ReturnType<typeof vi.fn>;
  };
  let quota: { consume: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      character: { findUnique: vi.fn(), update: vi.fn() },
      mediaAsset: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
      $transaction: vi.fn(),
    };
    storage = {
      driver: 'local',
      publicUrl: vi.fn((key: string) => `${BASE}/${key}`),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteIfOwned: vi.fn().mockResolvedValue(true),
    };
    quota = { consume: vi.fn().mockResolvedValue({ allowed: true, limit: 5, remaining: 4, retryAfterSeconds: 0 }) };

    prisma.mediaAsset.create.mockResolvedValue({ id: 'asset-1' });
    // Devolvemos la URL que el propio servicio calculó, como haría Postgres.
    prisma.character.update.mockImplementation(({ data }: { data: { avatarUrl?: string | null } }) =>
      Promise.resolve({
        id: 'char-1',
        name: 'ElViajero',
        avatarUrl: data.avatarUrl ?? null,
        updatedAt: new Date(),
      }),
    );
    prisma.$transaction.mockImplementation((operations: unknown[]) => Promise.all(operations));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuotaService, useValue: quota },
        { provide: MEDIA_STORAGE, useValue: storage },
      ],
    }).compile();

    service = module.get<AvatarService>(AvatarService);
  });

  const upload = (overrides: Record<string, unknown> = {}) => ({
    buffer: PNG,
    originalname: 'avatar.png',
    mimetype: 'image/png',
    size: PNG.length,
    ...overrides,
  });

  it('normaliza la imagen a WebP y registra el MediaAsset', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', avatarUrl: null });

    const result = await service.uploadAvatar('user-1', upload());

    const stored = storage.put.mock.calls[0][0];
    expect(stored.key).toMatch(/^avatars\/char-1\/[0-9a-f-]{36}\.webp$/);
    expect(stored.contentType).toBe('image/webp');
    expect(stored.cacheControl).toContain('immutable');

    // La salida es realmente un WebP y respeta el tamaño máximo configurado.
    const outputMeta = await sharp(stored.body).metadata();
    expect(outputMeta.format).toBe('webp');
    expect(outputMeta.width).toBeLessThanOrEqual(env.avatar.outputSize);
    expect(outputMeta.exif).toBeUndefined();

    expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityType: 'AVATAR', entityId: 'char-1', mimeType: 'image/webp' }),
      }),
    );
    expect(result.avatarUrl).toBe(storage.publicUrl(stored.key));
  });

  it('elimina el avatar anterior al reemplazarlo', async () => {
    prisma.character.findUnique.mockResolvedValue({
      id: 'char-1',
      avatarUrl: `${BASE}/avatars/char-1/viejo.webp`,
    });

    await service.uploadAvatar('user-1', upload());

    expect(storage.delete).toHaveBeenCalledWith('avatars/char-1/viejo.webp');
  });

  it('no toca recursos externos al reemplazar el avatar', async () => {
    prisma.character.findUnique.mockResolvedValue({
      id: 'char-1',
      avatarUrl: 'https://ejemplo-externo.com/foto.png',
    });

    await service.uploadAvatar('user-1', upload());

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('borra el objeto subido si la transacción de BD falla', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', avatarUrl: null });
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('boom', { code: 'P2003', clientVersion: '5.22.0' }),
    );

    await expect(service.uploadAvatar('user-1', upload())).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );

    const key = storage.put.mock.calls[0][0].key;
    expect(storage.delete).toHaveBeenCalledWith(key);
  });

  it('rechaza imágenes SVG (vector de XSS)', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', avatarUrl: null });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    await expect(
      service.uploadAvatar('user-1', upload({ buffer: svg, mimetype: 'image/svg+xml' })),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('rechaza archivos que no son imágenes aunque declaren un MIME válido', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', avatarUrl: null });
    const fake = Buffer.from('<?php system($_GET["c"]); ?>', 'utf8');

    await expect(
      service.uploadAvatar('user-1', upload({ buffer: fake, mimetype: 'image/png' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza archivos vacíos', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', avatarUrl: null });

    await expect(
      service.uploadAvatar('user-1', upload({ buffer: Buffer.alloc(0), size: 0 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza archivos que superan el tamaño máximo', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', avatarUrl: null });

    await expect(
      service.uploadAvatar('user-1', upload({ size: env.avatar.maxBytes + 1 })),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('rechaza imágenes bomba por exceso de píxeles', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', avatarUrl: null });
    const big = await makePng(64, 64); // 4096 px, por encima del límite del test
    const original = env.avatar.maxPixels;
    env.avatar.maxPixels = 100;
    try {
      await expect(service.uploadAvatar('user-1', upload({ buffer: big }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    } finally {
      env.avatar.maxPixels = original;
    }
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('aplica la cuota de subidas por usuario', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1', avatarUrl: null });
    quota.consume.mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      retryAfterSeconds: 120,
    });

    const error = await service.uploadAvatar('user-1', upload()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('exige que el personaje exista', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(service.uploadAvatar('user-1', upload())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('elimina el avatar y es idempotente si ya no hay ninguno', async () => {
    prisma.character.findUnique.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: `${BASE}/avatars/char-1/uno.webp`,
    });
    prisma.character.update.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: null,
      updatedAt: new Date(),
    });

    const result = await service.removeAvatar('user-1');

    expect(prisma.character.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { avatarUrl: null } }),
    );
    expect(storage.delete).toHaveBeenCalledWith('avatars/char-1/uno.webp');
    expect(result.avatarUrl).toBeNull();

    vi.clearAllMocks();
    prisma.character.findUnique.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: null,
    });

    await expect(service.removeAvatar('user-1')).resolves.toMatchObject({ avatarUrl: null });
    expect(prisma.character.update).not.toHaveBeenCalled();
  });
});
