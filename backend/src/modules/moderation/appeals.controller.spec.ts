import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppealsController } from './appeals.controller';
import { ModerationService } from './moderation.service';

describe('AppealsController', () => {
  let controller: AppealsController;
  let service: {
    createAppeal: ReturnType<typeof vi.fn>;
    listMyAppeals: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      createAppeal: vi.fn().mockResolvedValue({ id: 'a1' }),
      listMyAppeals: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppealsController],
      providers: [Reflector, { provide: ModerationService, useValue: service }],
    }).compile();

    controller = module.get(AppealsController);
  });

  it('está protegido por el guard de sesión', () => {
    const guards = Reflect.getMetadata('__guards__', AppealsController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('crea la apelación con el usuario del token, nunca del cuerpo', () => {
    const dto = { targetType: 'STORY', targetId: 's1', message: 'motivo suficiente' };
    controller.create({ user: { userId: 'user-1' } } as never, dto as never);
    expect(service.createAppeal).toHaveBeenCalledWith('user-1', dto);
  });

  it('lista solo las apelaciones del usuario del token', () => {
    const query = { limit: 10 };
    controller.listMine({ user: { userId: 'user-2' } } as never, query as never);
    expect(service.listMyAppeals).toHaveBeenCalledWith('user-2', query);
  });
});
