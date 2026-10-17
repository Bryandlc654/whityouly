import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { AdminModerationController } from './admin-moderation.controller';
import { ModerationService } from './moderation.service';

describe('AdminModerationController', () => {
  let controller: AdminModerationController;
  let service: {
    listReports: ReturnType<typeof vi.fn>;
    updateReport: ReturnType<typeof vi.fn>;
    moderateContent: ReturnType<typeof vi.fn>;
    listAppeals: ReturnType<typeof vi.fn>;
    resolveAppeal: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listReports: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      updateReport: vi.fn().mockResolvedValue({}),
      moderateContent: vi.fn().mockResolvedValue({}),
      listAppeals: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      resolveAppeal: vi.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminModerationController],
      providers: [{ provide: ModerationService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminModerationController);
  });

  it('exige sesión y rol en todos sus endpoints', () => {
    const guards = Reflect.getMetadata('__guards__', AdminModerationController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('declara los roles permitidos MODERATOR y ADMIN', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminModerationController);
    expect(roles).toEqual(['MODERATOR', 'ADMIN']);
  });

  it('delega el listado de reportes con la consulta', () => {
    const query = { status: 'PENDING' };
    controller.listReports(query as never);
    expect(service.listReports).toHaveBeenCalledWith(query);
  });

  it('delega la moderación del contenido con el admin del token y el id de ruta', () => {
    controller.moderate({ user: { userId: 'admin-1' } } as never, 'r1', { action: 'HIDE' } as never);
    expect(service.moderateContent).toHaveBeenCalledWith('admin-1', 'r1', { action: 'HIDE' });
  });

  it('delega la resolución de la apelación con el admin del token', () => {
    controller.resolveAppeal({ user: { userId: 'admin-1' } } as never, 'a1', {
      status: 'ACCEPTED',
    } as never);
    expect(service.resolveAppeal).toHaveBeenCalledWith('admin-1', 'a1', { status: 'ACCEPTED' });
  });
});
