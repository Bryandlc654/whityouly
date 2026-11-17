import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentPreferencesService } from './content-preferences.service';
import type { PrismaService } from '../../prisma/prisma.service';

const prisma = {
  character: { findFirst: vi.fn(), findUnique: vi.fn() },
  authorPreference: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
};

describe('ContentPreferencesService', () => {
  let service: ContentPreferencesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContentPreferencesService(prisma as unknown as PrismaService);
  });

  it('guarda el id del personaje al crear un bloqueo', async () => {
    prisma.character.findFirst.mockResolvedValue({ id: 'char-2' });
    prisma.authorPreference.upsert.mockResolvedValue({ id: 'pref-1' });

    await service.create('user-1', 'LuzEnPausa', 'BLOCK');

    expect(prisma.authorPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ characterId: 'char-2', kind: 'BLOCK' }),
        update: { characterId: 'char-2' },
      }),
    );
  });

  it('detecta el bloqueo en cualquiera de las dos direcciones', async () => {
    prisma.authorPreference.findFirst.mockResolvedValue({ id: 'pref-1' });

    await expect(
      service.blockedRelation('user-1', 'char-1', 'user-2', 'char-2'),
    ).resolves.toBe(true);
    expect(prisma.authorPreference.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'BLOCK',
          OR: [
            { userId: 'user-1', characterId: 'char-2' },
            { userId: 'user-2', characterId: 'char-1' },
          ],
        }),
      }),
    );
  });

  it('no consulta si falta alguno de los personajes', async () => {
    await expect(service.blockedRelation('user-1', null, 'user-2', 'char-2')).resolves.toBe(
      false,
    );
    expect(prisma.authorPreference.findFirst).not.toHaveBeenCalled();
  });
});
