import { Test, TestingModule } from '@nestjs/testing';
import { EmailChangeController } from './email-change.controller';
import { AccountService } from './account.service';

describe('EmailChangeController', () => {
  let controller: EmailChangeController;
  let accountService: { confirmEmailChange: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    accountService = { confirmEmailChange: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailChangeController],
      providers: [{ provide: AccountService, useValue: accountService }],
    }).compile();

    controller = module.get(EmailChangeController);
  });

  it('confirma con el token, sin depender de la sesión', async () => {
    accountService.confirmEmailChange.mockResolvedValue({ message: 'ok', email: 'nuevo@correo.com' });

    const result = await controller.confirmEmailChange({ token: 'tok' });

    expect(accountService.confirmEmailChange).toHaveBeenCalledWith({ token: 'tok' });
    expect(result).toEqual({ message: 'ok', email: 'nuevo@correo.com' });
  });
});
