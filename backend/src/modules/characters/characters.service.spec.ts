import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CharactersService,
  normalizeCharacterName,
  sanitizeBio,
  sanitizeTagline,
} from './characters.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('CharactersService', () => {
  let service: CharactersService;
  let prisma: {
    character: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    characterInterest: {
      deleteMany: ReturnType<typeof vi.fn>;
      createMany: ReturnType<typeof vi.fn>;
    };
    interest: { findMany: ReturnType<typeof vi.fn> };
    analyticsEvent: { create: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };

  const characterRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'char-1',
    name: 'ElViajero',
    tagline: null,
    avatarUrl: null,
    bio: null,
    privacySettings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    interests: [],
    ...overrides,
  });

  /**
   * La ruta pública localiza el seudónimo con la consulta indexada y después
   * carga la fila por clave primaria.
   */
  const mockPublicProfile = (row: Record<string, unknown>) => {
    prisma.$queryRaw.mockResolvedValue([{ id: row.id }]);
    prisma.character.findUnique.mockResolvedValue(row);
  };

  beforeEach(async () => {
    prisma = {
      character: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      characterInterest: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      interest: { findMany: vi.fn().mockResolvedValue([]) },
      analyticsEvent: { create: vi.fn().mockResolvedValue({}) },
      follower: { count: vi.fn().mockResolvedValue(0) },
      companionship: { count: vi.fn().mockResolvedValue(0) },
      story: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      // La búsqueda por seudónimo va en SQL parametrizado para poder usar el
      // índice funcional; por defecto no encuentra a nadie.
      $queryRaw: vi.fn().mockResolvedValue([]),
    };

    // El servicio usa transacciones interactivas; el mock simula el executor.
    (prisma as { $transaction?: unknown }).$transaction = vi.fn(
      (callback: (tx: unknown) => unknown) => callback(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [CharactersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CharactersService>(CharactersService);
  });

  it('crea la identidad seudónima sin exponer userId', async () => {
    prisma.character.findUnique.mockResolvedValue(null);
    prisma.character.create.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: null,
      bio: null,
      privacySettings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create('user-1', { name: 'ElViajero' } as any);

    expect(prisma.character.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'ElViajero',
          bio: null,
          avatarUrl: null,
          userId: 'user-1',
          privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: true },
        }),
      }),
    );
    expect(result).not.toHaveProperty('userId');
    expect(result.name).toBe('ElViajero');
  });

  it('rechaza un seudónimo reservado', async () => {
    await expect(service.create('user-1', { name: 'Ad-Min' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('rechaza si la cuenta ya tiene un seudónimo', async () => {
    prisma.character.findUnique.mockResolvedValue({ id: 'char-1' });

    await expect(service.create('user-1', { name: 'Otro' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('detecta nombres repetidos sin distinguir mayúsculas', async () => {
    prisma.character.findUnique.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([{ id: 'char-2' }]);

    await expect(service.create('user-1', { name: 'elviajero' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
    // La forma `lower(name) = lower(...)` es la que resuelve el índice funcional;
    // con `mode: 'insensitive'` Prisma genera `ILIKE`, que no usa ningún índice.
    const [query] = prisma.$queryRaw.mock.calls[0];
    expect(query.strings.join('?')).toContain('lower("name") = lower(?)');
    expect(query.strings.join('?')).not.toContain('ILIKE');
    expect(query.values).toEqual(['elviajero']);
  });

  it('convierte la violación de unicidad (carrera) en conflicto', async () => {
    prisma.character.findUnique.mockResolvedValue(null);
    prisma.character.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5.22.0' }),
    );

    await expect(service.create('user-1', { name: 'ElViajero' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza un avatar alojado en un dominio externo', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(
      service.create('user-1', {
        name: 'ElViajero',
        avatarUrl: 'https://sitio-externo.com/foto.png',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('lanza NotFound al consultar una identidad inexistente', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(service.findByUserId('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('informa disponibilidad del seudónimo', async () => {
    await expect(service.isNameAvailable('Libre123')).resolves.toEqual({ available: true });

    prisma.$queryRaw.mockResolvedValue([{ id: 'char-1' }]);
    await expect(service.isNameAvailable('ocupado')).resolves.toEqual({
      available: false,
      reason: 'Ese nombre ya está en uso',
    });

    await expect(service.isNameAvailable('admin')).resolves.toEqual({
      available: false,
      reason: 'Ese nombre está reservado',
    });
  });

  it('guarda los ajustes de privacidad enviados al crear', async () => {
    prisma.character.findUnique.mockResolvedValue(null);
    prisma.character.create.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: null,
      bio: 'Hola',
      privacySettings: { profileVisibility: 'PRIVATE', showAvatar: false, showBio: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create('user-1', {
      name: 'ElViajero',
      privacySettings: { profileVisibility: 'PRIVATE', showAvatar: false, showBio: false },
    } as any);

    expect(prisma.character.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          privacySettings: { profileVisibility: 'PRIVATE', showAvatar: false, showBio: false },
        }),
      }),
    );
    expect(result.privacySettings).toEqual({
      profileVisibility: 'PRIVATE',
      showAvatar: false,
      showBio: false,
    });
  });

  it('expone el perfil público sin userId ni ajustes de privacidad', async () => {
    mockPublicProfile({
      id: 'char-1',
      name: 'ElViajero',
      tagline: null,
      avatarUrl: 'https://cdn.whityouly.com/a.png',
      bio: 'Bio pública',
      privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: true },
      interests: [],
      createdAt: new Date(),
    });

    const result = await service.getPublicProfile('elviajero');

    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('privacySettings');
    expect(result.bio).toBe('Bio pública');
  });

  it('oculta avatar y bio cuando la privacidad lo indica', async () => {
    mockPublicProfile({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: 'https://cdn.whityouly.com/a.png',
      bio: 'Bio privada',
      privacySettings: { profileVisibility: 'PUBLIC', showAvatar: false, showBio: false },
      createdAt: new Date(),
    });

    const result = await service.getPublicProfile('ElViajero');

    expect(result.avatarUrl).toBeNull();
    expect(result.bio).toBeNull();
  });

  it('devuelve 404 para perfiles privados sin revelar su existencia', async () => {
    mockPublicProfile({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: null,
      bio: null,
      privacySettings: { profileVisibility: 'PRIVATE', showAvatar: true, showBio: true },
      createdAt: new Date(),
    });

    await expect(service.getPublicProfile('ElViajero')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza nombres absurdamente largos en la ruta pública', async () => {
    await expect(service.getPublicProfile('a'.repeat(500))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('fusiona los ajustes de privacidad al actualizar', async () => {
    prisma.character.findUnique.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: true },
    });
    prisma.character.update.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: null,
      bio: null,
      privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.update('user-1', { privacySettings: { showBio: false } } as any);

    expect(prisma.character.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: false },
        }),
      }),
    );
  });

  it('normaliza el seudónimo antes de guardarlo para no volverlo irrecuperable', async () => {
    prisma.character.findUnique.mockResolvedValue(null);
    prisma.character.create.mockResolvedValue({
      id: 'char-1',
      name: 'Ana Del Valle',
      avatarUrl: null,
      bio: null,
      privacySettings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.create('user-1', { name: '  Ana   Del Valle ' } as any);

    expect(prisma.character.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Ana Del Valle' }) }),
    );
  });

  it('rechaza un seudónimo que se queda vacío tras normalizar', async () => {
    prisma.character.findUnique.mockResolvedValue(null);

    await expect(service.create('user-1', { name: '   ' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.character.create).not.toHaveBeenCalled();
  });

  it('impide vaciar un seudónimo ya creado', async () => {
    prisma.character.findUnique.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      privacySettings: null,
    });

    await expect(service.update('user-1', { name: '  ' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.character.update).not.toHaveBeenCalled();
  });

  it('elimina de la biografía los caracteres invisibles y de control', () => {
    // ancho cero dentro de una palabra: permite evadir filtros o suplantar
    expect(sanitizeBio('ad\u200Bmin\u200Bistrador')).toBe('administrador');
    // reordenación de texto bidireccional: puede invertir visualmente el texto
    expect(sanitizeBio('texto\u202Eocurro')).toBe('textoocurro');
    expect(sanitizeBio('salto\u0007 campana')).toBe('salto campana');
  });

  it('normaliza saltos de línea y espacios en la biografía', () => {
    expect(sanitizeBio('primera\r\n\r\n\r\n\r\nsegunda')).toBe('primera\n\nsegunda');
    expect(sanitizeBio('  con    espacios   sueltos  ')).toBe('con espacios sueltos');
  });

  it('convierte una biografía vacía en null para poder limpiarla', () => {
    expect(sanitizeBio('')).toBeNull();
    expect(sanitizeBio('   \n  ')).toBeNull();
    expect(sanitizeBio(null)).toBeNull();
    expect(sanitizeBio(undefined)).toBeNull();
  });

  it('recorta la biografía al límite máximo', () => {
    expect(sanitizeBio('a'.repeat(900))).toHaveLength(500);
  });

  it('guarda la biografía saneada', async () => {
    prisma.character.findUnique.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      privacySettings: null,
    });
    prisma.character.update.mockResolvedValue({
      id: 'char-1',
      name: 'ElViajero',
      avatarUrl: null,
      bio: 'hola',
      privacySettings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.update('user-1', { bio: ' hola\u200B \r\n mundo ' } as any);

    expect(prisma.character.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bio: 'hola\nmundo' }) }),
    );
  });

  it('sanea la biografía también al leer el perfil público', async () => {
    mockPublicProfile({
      id: 'char-1',
      name: 'ElViajero',
      tagline: null,
      avatarUrl: 'https://cdn.whityouly.com/a.png',
      bio: 'bio\u200B sucia',
      privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: true },
      interests: [],
      createdAt: new Date(),
    });

    const result = await service.getPublicProfile('ElViajero');

    expect(result.bio).toBe('bio sucia');
  });

  it('normaliza el seudónimo también en la ruta pública', async () => {
    await expect(service.getPublicProfile('  el  VIAJERO ')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const [query] = prisma.$queryRaw.mock.calls[0];
    expect(query.values).toEqual(['el VIAJERO']);
  });

  it('unifica el criterio de normalización entre escritura y lectura', () => {
    expect(normalizeCharacterName('  Ana\u00A0Del Valle ')).toBe('Ana Del Valle');
  });

  describe('descripción e intereses', () => {
    it('mantiene la descripción en una sola línea y sin invisibles', () => {
      expect(sanitizeTagline('  Escribo\u200B de\nmadrugada  ')).toBe('Escribo de madrugada');
      expect(sanitizeTagline('texto\u202Emalo')).toBe('textomalo');
      expect(sanitizeTagline('a'.repeat(300))).toHaveLength(120);
      expect(sanitizeTagline('   ')).toBeNull();
      expect(sanitizeTagline(null)).toBeNull();
    });

    it('crea el personaje con la descripción y los intereses del catálogo', async () => {
      prisma.character.findUnique.mockResolvedValue(null);
      prisma.interest.findMany.mockResolvedValue([
        { id: 'int-musica', name: 'Música' },
        { id: 'int-arte', name: 'Arte' },
      ]);
      prisma.character.create.mockResolvedValue(
        characterRow({ tagline: 'Escribo de madrugada', interests: [{ interest: { name: 'Arte' } }] }),
      );

      const result = await service.create('user-1', {
        name: 'ElViajero',
        tagline: 'Escribo\u200B de madrugada',
        interests: ['Música', 'Arte'],
      } as any);

      expect(prisma.interest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: { in: ['Música', 'Arte'], mode: 'insensitive' } } }),
      );
      expect(prisma.character.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tagline: 'Escribo de madrugada',
            interests: { create: [{ interestId: 'int-musica' }, { interestId: 'int-arte' }] },
          }),
        }),
      );
      expect(result.tagline).toBe('Escribo de madrugada');
      expect(result.interests).toEqual(['Arte']);
    });

    it('rechaza un interés que no está en el catálogo y no crea nada', async () => {
      prisma.character.findUnique.mockResolvedValue(null);
      prisma.interest.findMany.mockResolvedValue([{ id: 'int-musica', name: 'Música' }]);

      await expect(
        service.create('user-1', { name: 'ElViajero', interests: ['Música', 'Inventado'] } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.character.create).not.toHaveBeenCalled();
    });

    it('rechaza un interés inventado al actualizar sin tocar lo ya guardado', async () => {
      prisma.character.findUnique.mockResolvedValue({
        id: 'char-1',
        name: 'ElViajero',
        privacySettings: null,
      });
      prisma.interest.findMany.mockResolvedValue([]);

      await expect(
        service.update('user-1', { interests: ['Inventado'] } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.characterInterest.deleteMany).not.toHaveBeenCalled();
      expect(prisma.character.update).not.toHaveBeenCalled();
    });

    it('reemplaza la lista completa de intereses dentro de una transacción', async () => {
      prisma.character.findUnique.mockResolvedValue({
        id: 'char-1',
        name: 'ElViajero',
        privacySettings: null,
      });
      prisma.interest.findMany.mockResolvedValue([
        { id: 'int-arte', name: 'Arte' },
        { id: 'int-musica', name: 'Música' },
      ]);
      prisma.character.update.mockResolvedValue(characterRow());

      await service.update('user-1', { interests: ['Arte', 'Música'] } as any);

      expect(prisma.characterInterest.deleteMany).toHaveBeenCalledWith({
        where: { characterId: 'char-1' },
      });
      expect(prisma.characterInterest.createMany).toHaveBeenCalledWith({
        data: [
          { characterId: 'char-1', interestId: 'int-arte' },
          { characterId: 'char-1', interestId: 'int-musica' },
        ],
        skipDuplicates: true,
      });
    });

    it('permite dejar la lista de intereses vacía', async () => {
      prisma.character.findUnique.mockResolvedValue({
        id: 'char-1',
        name: 'ElViajero',
        privacySettings: null,
      });
      prisma.character.update.mockResolvedValue(characterRow());

      await service.update('user-1', { interests: [] } as any);

      expect(prisma.characterInterest.deleteMany).toHaveBeenCalled();
      expect(prisma.characterInterest.createMany).not.toHaveBeenCalled();
    });

    it('no toca los intereses si el campo no viene en la actualización', async () => {
      prisma.character.findUnique.mockResolvedValue({
        id: 'char-1',
        name: 'ElViajero',
        privacySettings: null,
      });
      prisma.character.update.mockResolvedValue(characterRow());

      await service.update('user-1', { tagline: 'Solo el lema' } as any);

      expect(prisma.interest.findMany).not.toHaveBeenCalled();
      expect(prisma.characterInterest.deleteMany).not.toHaveBeenCalled();
    });

    it('expone descripción e intereses en el perfil público', async () => {
      mockPublicProfile(
        characterRow({
          tagline: 'Escribo de madrugada',
          bio: 'Bio',
          privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: true },
          interests: [{ interest: { name: 'Música' } }, { interest: { name: 'Arte' } }],
        }),
      );

      const result = await service.getPublicProfile('ElViajero');

      expect(result.tagline).toBe('Escribo de madrugada');
      expect(result.interests).toEqual(['Arte', 'Música']);
    });

    it('oculta descripción e intereses cuando la biografía está oculta', async () => {
      mockPublicProfile(
        characterRow({
          tagline: 'Escribo de madrugada',
          bio: 'Bio',
          privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: false },
          interests: [{ interest: { name: 'Música' } }],
        }),
      );

      const result = await service.getPublicProfile('ElViajero');

      expect(result.tagline).toBeNull();
      expect(result.bio).toBeNull();
      expect(result.interests).toEqual([]);
    });
  });
});
