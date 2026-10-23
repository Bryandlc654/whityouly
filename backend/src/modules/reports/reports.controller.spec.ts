import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: { listMine: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = {
      listMine: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ReportsController);
  });

  it('está protegido por el guard de sesión', () => {
    const guards = Reflect.getMetadata('__guards__', ReportsController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('usa el usuario del token y nunca uno del cuerpo o la ruta', () => {
    const query = { status: 'PENDING' };
    controller.listMine({ user: { userId: 'user-1' } } as never, query as never);
    expect(service.listMine).toHaveBeenCalledWith('user-1', query);
  });
});
