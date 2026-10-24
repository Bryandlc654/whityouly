import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

describe('SupportController', () => {
  let controller: SupportController;
  let service: {
    create: ReturnType<typeof vi.fn>;
    listMine: ReturnType<typeof vi.fn>;
    getMine: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      create: vi.fn().mockResolvedValue({ id: 't1' }),
      listMine: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      getMine: vi.fn().mockResolvedValue({ id: 't1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [{ provide: SupportService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SupportController);
  });

  it('está protegido por el guard de sesión', () => {
    const guards = Reflect.getMetadata('__guards__', SupportController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('crea la solicitud con el usuario del token', () => {
    const dto = { category: 'ACCOUNT' as const, body: 'Necesito ayuda con mi cuenta.' };
    controller.create({ user: { userId: 'user-1' } } as never, dto as never);
    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('lista y consulta solo con el usuario del token', () => {
    const query = { status: 'OPEN' as const };
    controller.listMine({ user: { userId: 'user-1' } } as never, query as never);
    expect(service.listMine).toHaveBeenCalledWith('user-1', query);

    controller.getMine({ user: { userId: 'user-1' } } as never, 't1');
    expect(service.getMine).toHaveBeenCalledWith('user-1', 't1');
  });
});
