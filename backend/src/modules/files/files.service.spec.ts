import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import { FilesService } from './files.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../../common/quota/quota.service';
import { MEDIA_STORAGE } from '../../common/storage/media-storage';
import { env } from '../../config/env';

describe('FilesService', () => {
  let service: FilesService;
  let prisma: {
    mediaAsset: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    storyUpdate: { count: ReturnType<typeof vi.fn> };
    creation: { count: ReturnType<typeof vi.fn> };
    musicTrack: { count: ReturnType<typeof vi.fn> };
  };
  let quota: { consume: ReturnType<typeof vi.fn> };
  let storage: { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; publicUrl: ReturnType<typeof vi.fn> };

  let jpeg: Buffer;

  beforeAll(async () => {
    jpeg = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 200, g: 120, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  beforeEach(async () => {
    prisma = {
      mediaAsset: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { sizeBytes: 0n } }),
      },
      storyUpdate: { count: vi.fn().mockResolvedValue(0) },
      creation: { count: vi.fn().mockResolvedValue(0) },
      musicTrack: { count: vi.fn().mockResolvedValue(0) },
    };
    quota = {
      consume: vi.fn().mockResolvedValue({ allowed: true, limit: 30, remaining: 29 }),
    };
    storage = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      publicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: QuotaService, useValue: quota },
        { provide: MEDIA_STORAGE, useValue: storage },
      ],
    }).compile();

    service = module.get(FilesService);
  });

  const upload = (overrides: Partial<{ originalname: string; mimetype: string }> = {}) => ({
    buffer: jpeg,
    originalname: 'foto.jpg',
    mimetype: 'image/jpeg',
    size: jpeg.byteLength,
    ...overrides,
  });

  describe('upload', () => {
    beforeEach(() => {
      prisma.mediaAsset.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'asset-1', createdAt: new Date(), ...data }),
      );
    });

    it('normaliza a WebP y guarda la clave bajo media/<usuario>/', async () => {
      const result = await service.upload('u-1', upload());

      const put = storage.put.mock.calls[0][0];
      expect(put.contentType).toBe('image/webp');
      expect(put.key).toMatch(/^media\/u-1\/[0-9a-f-]{36}\.webp$/);
      // la clave guardada es la misma que la del objeto, no una reconstrucción
      expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ key: put.key, entityType: 'NONE' }),
        }),
      );
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it('rechaza un archivo vacío', async () => {
      await expect(
        service.upload('u-1', { buffer: Buffer.alloc(0), originalname: 'x.jpg', mimetype: 'image/jpeg', size: 0 }),
      ).rejects.toThrow();
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('rechaza un archivo que no es una imagen aunque el MIME lo diga', async () => {
      const buffer = Buffer.from('<svg onload="alert(1)"></svg>');

      await expect(
        service.upload('u-1', {
          buffer,
          originalname: 'trampa.svg',
          mimetype: 'image/jpeg',
          size: buffer.byteLength,
        }),
      ).rejects.toThrow();
      expect(storage.put).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
    });

    it('respeta el límite de subidas por hora', async () => {
      quota.consume.mockResolvedValue({ allowed: false, limit: 30, retryAfterSeconds: 1200 });

      await expect(service.upload('u-1', upload())).rejects.toThrow(/límite de 30/);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('bloquea cuando la biblioteca ya está llena', async () => {
      prisma.mediaAsset.aggregate.mockResolvedValue({
        _sum: { sizeBytes: BigInt(env.files.maxTotalBytes) },
      });

      await expect(service.upload('u-1', upload())).rejects.toBeInstanceOf(ConflictException);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('borra el objeto si la base falla al registrar el archivo', async () => {
      prisma.mediaAsset.create.mockRejectedValue(new Error('db caída'));

      await expect(service.upload('u-1', upload())).rejects.toThrow('db caída');
      expect(storage.delete).toHaveBeenCalledTimes(1);
    });

    it('limpia solo el nombre de archivo del nombre original', async () => {
      await service.upload('u-1', upload({ originalname: '..\\..\\fotos\\mi foto.jpg' }));

      expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ originalName: 'mi foto.jpg' }) }),
      );
    });

    it('convierte sizeBytes a número en la respuesta', async () => {
      const result = await service.upload('u-1', upload());

      expect(typeof result.sizeBytes).toBe('number');
    });
  });

  describe('list', () => {
    it('devuelve cursor solo si hay más página', async () => {
      const row = (id: string) => ({
        id,
        fileUrl: `https://cdn.test/media/u-1/${id}.webp`,
        originalName: null,
        mimeType: 'image/webp',
        sizeBytes: 10n,
        width: 1,
        height: 1,
        entityType: 'NONE',
        createdAt: new Date(),
      });

      prisma.mediaAsset.findMany.mockResolvedValue([row('a'), row('b'), row('c')]);
      const page = await service.list('u-1', undefined, 2);

      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBe('b');
      expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u-1' }, take: 3 }),
      );
    });

    it('no fija cursor cuando la página está completa', async () => {
      prisma.mediaAsset.findMany.mockResolvedValue([]);
      const page = await service.list('u-1');

      expect(page.nextCursor).toBeNull();
    });
  });

  describe('remove', () => {
    it('borra la fila y el objeto', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: 'asset-1',
        key: 'media/u-1/x.webp',
        fileUrl: 'https://cdn.test/media/u-1/x.webp',
      });

      const result = await service.remove('u-1', 'asset-1');

      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
      expect(storage.delete).toHaveBeenCalledWith('media/u-1/x.webp');
      expect(result).toEqual({ id: 'asset-1' });
    });

    it('no toca archivos de otro usuario', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue(null);

      await expect(service.remove('u-2', 'asset-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('rechaza borrar un archivo que está en un relato', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: 'asset-1',
        key: 'media/u-1/x.webp',
        fileUrl: 'https://cdn.test/media/u-1/x.webp',
      });
      prisma.storyUpdate.count.mockResolvedValue(1);

      await expect(service.remove('u-1', 'asset-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('rechaza borrar un archivo usado como portada de una pista', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: 'asset-1',
        key: 'media/u-1/x.webp',
        fileUrl: 'https://cdn.test/media/u-1/x.webp',
      });
      prisma.musicTrack.count.mockResolvedValue(1);

      await expect(service.remove('u-1', 'asset-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('deduce la clave de la URL si la fila no la tiene (filas antiguas)', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: 'asset-1',
        key: null,
        fileUrl: `${env.storage.publicBaseUrl}/media/u-1/x.webp`,
      });

      await service.remove('u-1', 'asset-1');

      expect(storage.delete).toHaveBeenCalledWith('media/u-1/x.webp');
    });

    it('no borra nada si la URL apunta fuera de nuestro almacenamiento', async () => {
      prisma.mediaAsset.findFirst.mockResolvedValue({
        id: 'asset-1',
        key: null,
        fileUrl: 'https://otro-sitio.example/media/u-1/x.webp',
      });

      await service.remove('u-1', 'asset-1');

      // La fila se borra, pero el objeto ajeno se respeta.
      expect(prisma.mediaAsset.delete).toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('moderación', () => {
    it('lista archivos de cualquier usuario', async () => {
      prisma.mediaAsset.findMany.mockResolvedValue([
        {
          id: 'a',
          userId: 'u-9',
          fileUrl: 'https://cdn.test/media/u-9/a.webp',
          originalName: null,
          mimeType: 'image/webp',
          sizeBytes: 5n,
          width: 1,
          height: 1,
          entityType: 'NONE',
          createdAt: new Date(),
        },
      ]);

      const page = await service.listAll({ userId: 'u-9' });

      expect(page.items[0].userId).toBe('u-9');
      expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u-9' } }),
      );
    });

    it('borra el archivo sin mirar quién es el dueño', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        id: 'asset-9',
        key: 'media/u-9/x.webp',
        fileUrl: 'https://cdn.test/media/u-9/x.webp',
      });

      await service.removeAsModerator('asset-9');

      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-9' } });
    });

    it('falla si el archivo no existe', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);

      await expect(service.removeAsModerator('fantasma')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
