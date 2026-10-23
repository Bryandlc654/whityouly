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
    decideReport: ReturnType<typeof vi.fn>;
    listActions: ReturnType<typeof vi.fn>;
    revertAction: ReturnType<typeof vi.fn>;
    moderateContent: ReturnType<typeof vi.fn>;
    listAppeals: ReturnType<typeof vi.fn>;
    resolveAppeal: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listReports: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      updateReport: vi.fn().mockResolvedValue({}),
      decideReport: vi.fn().mockResolvedValue({}),
      listActions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      revertAction: vi.fn().mockResolvedValue({}),
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

  it('delega la decisión con el admin del token, el reporte y el motivo', () => {
    const dto = { action: 'HIDE' as const, reason: 'Incumple las normas.' };
    controller.decide({ user: { userId: 'admin-1' } } as never, 'r1', dto as never);
    expect(service.decideReport).toHaveBeenCalledWith('admin-1', 'r1', dto);
  });

  it('lista el historial y revierte con el admin del token', () => {
    const query = { action: 'HIDE' as const };
    controller.listActions(query as never);
    expect(service.listActions).toHaveBeenCalledWith(query);

    const dto = { reason: 'La revisión lo desmiente.' };
    controller.revertAction({ user: { userId: 'admin-1' } } as never, 'act-1', dto as never);
    expect(service.revertAction).toHaveBeenCalledWith('admin-1', 'act-1', dto);
  });

  it('delega la resolución de la apelación con el admin del token', () => {
    controller.resolveAppeal({ user: { userId: 'admin-1' } } as never, 'a1', {
      status: 'ACCEPTED',
    } as never);
    expect(service.resolveAppeal).toHaveBeenCalledWith('admin-1', 'a1', { status: 'ACCEPTED' });
  });
});
