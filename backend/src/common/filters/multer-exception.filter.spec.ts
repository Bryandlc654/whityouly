import { HttpStatus } from '@nestjs/common';
import { MulterError } from 'multer';
import { MulterExceptionFilter } from './multer-exception.filter';

function createHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, json }),
      getRequest: () => ({ method: 'POST', url: '/characters/me/avatar' }),
    }),
  };
  return { host, status, json };
}

const multerError = (code: string) =>
  Object.assign(new Error(code), { code }) as MulterError;

describe('MulterExceptionFilter', () => {
  it('traduce un archivo demasiado grande a 413', () => {
    const { host, status, json } = createHost();

    new MulterExceptionFilter().catch(multerError('LIMIT_FILE_SIZE'), host as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'La imagen supera el tamaño máximo permitido.',
      }),
    );
  });

  it('traduce el resto de límites de multer a 400', () => {
    const { host, status, json } = createHost();

    new MulterExceptionFilter().catch(multerError('LIMIT_UNEXPECTED_FILE'), host as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'El campo de archivo esperado es "file".' }),
    );
  });

  it('impide que un uploadmultipart con campos de más se procese', () => {
    const { host, status } = createHost();

    new MulterExceptionFilter().catch(multerError('LIMIT_PART_COUNT'), host as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });
});
