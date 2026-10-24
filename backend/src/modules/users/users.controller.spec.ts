import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { AccountService } from './account.service.js';
import { DataExportService } from './data-export.service.js';

describe('UsersController', () => {
  let controller: UsersController;
  let accountService: {
    getAccount: ReturnType<typeof vi.fn>;
    updatePreferences: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    requestEmailChange: ReturnType<typeof vi.fn>;
    requestDeletion: ReturnType<typeof vi.fn>;
    getDeletion: ReturnType<typeof vi.fn>;
    cancelDeletion: ReturnType<typeof vi.fn>;
    deleteAccount: ReturnType<typeof vi.fn>;
  };
  let dataExport: { exportAccount: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    accountService = {
      getAccount: vi.fn(),
      updatePreferences: vi.fn(),
      changePassword: vi.fn(),
      requestEmailChange: vi.fn(),
      requestDeletion: vi.fn(),
      getDeletion: vi.fn(),
      cancelDeletion: vi.fn(),
      deleteAccount: vi.fn(),
    };
    dataExport = { exportAccount: vi.fn().mockResolvedValue({ version: 1 }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: DataExportService, useValue: dataExport },
      ],
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

  it('solicita y cancela la baja con el usuario del token', () => {
    const dto = { currentPassword: 'Actual1234', confirmation: 'ELIMINAR' };
    controller.requestDeletion({ user: { userId: 'u1' } } as never, dto as never);
    expect(accountService.requestDeletion).toHaveBeenCalledWith('u1', dto);

    controller.getDeletion({ user: { userId: 'u1' } } as never);
    expect(accountService.getDeletion).toHaveBeenCalledWith('u1');

    controller.cancelDeletion({ user: { userId: 'u1' } } as never);
    expect(accountService.cancelDeletion).toHaveBeenCalledWith('u1');
  });

  it('exporta solo la cuenta del token y fuerza descarga sin caché', async () => {
    const response = { setHeader: vi.fn() };

    await controller.exportData(
      { user: { userId: 'u1' } } as never,
      response as never,
    );

    expect(dataExport.exportAccount).toHaveBeenCalledWith('u1');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('withyouly-mis-datos'),
    );
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
