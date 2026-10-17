import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

describe('CommunityController', () => {
  let controller: CommunityController;
  let service: { pulse: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    service = { pulse: vi.fn().mockResolvedValue({ privacy: { suppressed: true } }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [Reflector, { provide: CommunityService, useValue: service }],
    }).compile();

    controller = module.get(CommunityController);
  });

  it('está protegido por el guard de sesión', () => {
    const guards = Reflect.getMetadata('__guards__', CommunityController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('delega el pulso al servicio con la consulta validada', () => {
    const query = { days: 14, tzOffsetMinutes: -120 };
    controller.pulse(query as never);
    expect(service.pulse).toHaveBeenCalledWith(query);
  });

  it('no expone identificadores de usuarios en la respuesta', async () => {
    const result = await controller.pulse({ days: 7, tzOffsetMinutes: 0 } as never);
    expect(JSON.stringify(result)).not.toContain('userId');
  });
});
