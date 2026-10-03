import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { AccountService } from './account.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  let accountService: {
    getAccount: ReturnType<typeof vi.fn>;
    updatePreferences: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    requestEmailChange: ReturnType<typeof vi.fn>;
    deleteAccount: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    accountService = {
      getAccount: vi.fn(),
      updatePreferences: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn(),
      deleteAccount: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: AccountService, useValue: accountService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delega la lectura de la cuenta al servicio con el id del token', () => {
    accountService.getAccount.mockReturnValue({ id: 'u1' });

    controller.getMe({ user: { userId: 'u1' } } as never);

    expect(accountService.getAccount).toHaveBeenCalledWith('u1');
  });

  it('no acepta el id de cuenta del cuerpo: solo el del token', () => {
    accountService.updatePreferences.mockReturnValue({});

    controller.updatePreferences(
      { user: { userId: 'u1' } } as never,
      { theme: 'dark' } as never,
    );

    // El DTO validado no trae id: la cuenta es siempre la del token.
    expect(accountService.updatePreferences).toHaveBeenCalledWith('u1', { theme: 'dark' });
  });
});
