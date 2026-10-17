import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TreeController } from './tree.controller';
import { TreeService } from './tree.service';

describe('TreeController', () => {
  let controller: TreeController;
  let service: { getTree: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { getTree: vi.fn().mockResolvedValue({ totalDrops: 0 }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TreeController],
      providers: [{ provide: TreeService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TreeController);
  });

  it('está protegido por el guard de sesión', () => {
    const guards = Reflect.getMetadata('__guards__', TreeController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('devuelve el árbol del usuario del token, nunca de otro', () => {
    controller.getTree({ user: { userId: 'user-1' } } as never);
    expect(service.getTree).toHaveBeenCalledWith('user-1');
  });
});
